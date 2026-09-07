import { execSync } from 'child_process';
import { Logger } from '../../logging/logger';
import { EventSink } from '../eventSink';
import { AgentState } from '../state';
import { EventType } from '../../events/types';
import { nowIso } from '../../utils/time';
import { AppConfig } from '../../config/schema';

import { EventQueue } from '../../database/eventQueue';

interface Segment {
  application: string;
  process_id?: number;
  startedAt: string;
}

/**
 * Unique activity state for each browser tab using a stable tab identifier.
 *
 * Rules:
 *  1. When a browser tab is opened → emit BROWSER_ACTIVITY { action: 'OPEN' } with start_time.
 *  2. Switching to another tab → DO NOT set end_time for the previous tab (TAB_SWITCH).
 *  3. Returning to an existing tab → continue existing activity (TAB_RETURN), DO NOT create a new session.
 *  4. URL change within same tab → update URL/title (URL_CHANGE), DO NOT close tab.
 *  5. Closing actual tab / browser → set end_time and calculate duration_seconds = end_time - start_time (TAB_CLOSE / BROWSER_CLOSE).
 */
export interface TabState {
  tabKey: string;
  tabId: string;
  browser: string;
  url: string;
  domain: string;
  pageTitle: string;
  startedAt: string;
  openEventId: string;
  lastSeenAt: string;
  isCurrentlyActive: boolean;
}

type ActiveWinFn = (opts?: unknown) => Promise<{
  title: string;
  url?: string;
  owner?: { name?: string; processId?: number };
} | undefined>;

export class AppMonitor {
  private timer?: NodeJS.Timeout;
  private segment: Segment | null = null;
  /** Active tabs keyed by `${browser}:${tabId}` */
  private tabStates = new Map<string, TabState>();
  private activeWin: ActiveWinFn | null = null;
  private lastActiveTabKey: string | null = null;

  private static readonly BROWSER_NAMES = new Set([
    'Google Chrome', 'Safari', 'Firefox', 'Microsoft Edge',
    'Brave Browser', 'Arc', 'Opera', 'Vivaldi',
  ]);

  constructor(
    private cfg: AppConfig,
    private sink: EventSink,
    private state: AgentState,
    private log: Logger,
    private queue?: EventQueue
  ) {}

  async start(): Promise<void> {
    // Restore persistent tab states from SQLite to prevent duplicate sessions after restart
    if (this.queue) {
      try {
        const savedTabs = this.queue.loadTabStates();
        for (const t of savedTabs) {
          const tabId = t.tab_key.includes(':') ? t.tab_key.split(':').slice(1).join(':') : t.tab_key;
          this.tabStates.set(t.tab_key, {
            tabKey: t.tab_key,
            tabId,
            browser: t.browser,
            url: t.url,
            domain: t.domain,
            pageTitle: t.title,
            startedAt: t.started_at,
            openEventId: t.open_event_id,
            lastSeenAt: t.last_seen_at,
            isCurrentlyActive: false,
          });
        }
        if (savedTabs.length > 0) {
          this.log.info('restored open browser tab sessions from database', { count: savedTabs.length });
        }
      } catch (e) {
        this.log.warn('failed to restore browser tabs from database', { msg: (e as Error).message });
      }
    }

    try {
      // active-win v8 is ESM-only; dynamic import keeps us CJS-compatible.
      const spec = 'active-win';
      const mod = (await import(spec)) as { default?: ActiveWinFn } & ActiveWinFn;
      this.activeWin = (mod.default ?? mod) as ActiveWinFn;
    } catch (e) {
      this.log.warn('active-win unavailable; application monitoring disabled', {
        msg: (e as Error).message,
      });
      return;
    }
    if (this.timer) return;
    this.timer = setInterval(() => void this.poll(), this.cfg.appPollIntervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.closeSegment();
    // Flush all open tabs on agent shutdown
    for (const [browser] of this.getOpenBrowsers()) {
      this.closeBrowserTabs(browser, 'BROWSER_CLOSE');
    }
  }

  private getOpenBrowsers(): Set<string> {
    const browsers = new Set<string>();
    for (const tab of this.tabStates.values()) {
      browsers.add(tab.browser);
    }
    return browsers;
  }

  private async poll(): Promise<void> {
    if (!this.activeWin) return;
    if (this.state.privateMode) {
      this.closeSegment();
      for (const [browser] of this.getOpenBrowsers()) {
        this.closeBrowserTabs(browser, 'BROWSER_CLOSE');
      }
      return;
    }
    try {
      const win  = await this.activeWin();
      const name = win?.owner?.name?.trim();
      if (!name) return;

      // ── Application segment (one per contiguous foreground app) ──────────
      if (!this.segment || this.segment.application !== name) {
        this.closeSegment();
        this.segment = {
          application: name,
          process_id:  win?.owner?.processId,
          startedAt:   nowIso(),
        };
      }

      // ── Browser session tracking ─────────────────────────────────────────
      if (!this.cfg.browserTrackingEnabled) return;

      const isBrowser = AppMonitor.BROWSER_NAMES.has(name);

      if (isBrowser) {
        if (win) {
          this.processBrowserTabs(name, win);
        }
      } else {
        // Active window is NOT a browser.
        if (this.lastActiveTabKey && this.tabStates.has(this.lastActiveTabKey)) {
          const lastTab = this.tabStates.get(this.lastActiveTabKey)!;
          if (lastTab.isCurrentlyActive) {
            this.log.debug('[TAB_SWITCH] active window switched away from browser', {
              fromTabKey: this.lastActiveTabKey,
              activeApp:  name,
            });
            lastTab.isCurrentlyActive = false;
          }
        }
      }
    } catch (e) {
      this.log.debug('active window poll failed', { msg: (e as Error).message });
    }
  }

  /**
   * Fetches open tabs for the specified browser app and manages their lifecycle:
   * TAB_OPEN, TAB_SWITCH, TAB_RETURN, URL_CHANGE, TAB_CLOSE.
   */
  private processBrowserTabs(
    browserName: string,
    activeWin: { title: string; url?: string }
  ): void {
    const rawTabs = this.fetchOpenTabsFromOS(browserName, activeWin);
    const currentOpenTabKeys = new Set<string>();
    let currentActiveTabKey: string | null = null;

    for (const raw of rawTabs) {
      const tabKey = `${browserName}:${raw.tabId}`;
      currentOpenTabKeys.add(tabKey);
      if (raw.isActive) {
        currentActiveTabKey = tabKey;
      }
    }

    // 1. Process closed tabs (tabs in tabStates for this browser that no longer exist in browser)
    for (const [key, tab] of this.tabStates.entries()) {
      if (tab.browser === browserName && !currentOpenTabKeys.has(key)) {
        this.closeTab(key, 'TAB_CLOSE');
      }
    }

    // 2. Process open tabs
    for (const raw of rawTabs) {
      const tabKey  = `${browserName}:${raw.tabId}`;
      const url     = raw.url;
      const title   = raw.title || 'Untitled';
      let domain  = '';
      try { domain = new URL(url).hostname; } catch { domain = 'unknown'; }

      const existing = this.tabStates.get(tabKey);

      if (!existing) {
        // ── TAB_OPEN: New tab opened ──────────────────────────────────────
        const startedAt = nowIso();
        const openEvent = this.sink.push(EventType.BROWSER_ACTIVITY, {
          data: {
            action:     'OPEN',
            browser:    browserName,
            domain,
            url,
            page_title: title,
            started_at: startedAt,
          },
        });

        const newTab: TabState = {
          tabKey,
          tabId:             raw.tabId,
          browser:           browserName,
          url,
          domain,
          pageTitle:         title,
          startedAt,
          openEventId:       openEvent.event_id,
          lastSeenAt:        startedAt,
          isCurrentlyActive: raw.isActive,
        };

        this.tabStates.set(tabKey, newTab);
        if (this.queue) {
          this.queue.saveTabState({
            tab_key: tabKey,
            browser: browserName,
            url,
            domain,
            title,
            started_at: startedAt,
            open_event_id: openEvent.event_id,
            last_seen_at: startedAt,
          });
        }

        this.log.info('[TAB_OPEN] tab opened', {
          tabKey,
          browser:       browserName,
          domain,
          url,
          startedAt,
          open_event_id: openEvent.event_id,
        });
      } else {
        // ── Existing tab ─────────────────────────────────────────────────
        existing.lastSeenAt = nowIso();

        // ── URL_CHANGE: URL changed within same tab ───────────────────────
        if (existing.url !== url) {
          this.log.info('[URL_CHANGE] url updated in tab', {
            tabKey,
            oldUrl:   existing.url,
            newUrl:   url,
            oldTitle: existing.pageTitle,
            newTitle: title,
          });
          existing.url       = url;
          existing.domain    = domain;
          existing.pageTitle = title;
          if (this.queue) {
            this.queue.saveTabState({
              tab_key: tabKey,
              browser: existing.browser,
              url,
              domain,
              title,
              started_at: existing.startedAt,
              open_event_id: existing.openEventId,
              last_seen_at: existing.lastSeenAt,
            });
          }
        }

        // ── TAB_RETURN: Returned to existing tab ─────────────────────────
        if (raw.isActive && !existing.isCurrentlyActive) {
          this.log.info('[TAB_RETURN] returned to existing tab', {
            tabKey,
            browser:   browserName,
            domain:    existing.domain,
            url:       existing.url,
            startedAt: existing.startedAt,
          });
          existing.isCurrentlyActive = true;
        } else if (!raw.isActive && existing.isCurrentlyActive) {
          // ── TAB_SWITCH: Switched away from active tab ─────────────────────
          this.log.info('[TAB_SWITCH] switched away from tab', {
            fromTabKey: tabKey,
            toTabKey:   currentActiveTabKey,
          });
          existing.isCurrentlyActive = false;
        }
      }
    }

    if (currentActiveTabKey && currentActiveTabKey !== this.lastActiveTabKey) {
      if (this.lastActiveTabKey && this.tabStates.has(this.lastActiveTabKey)) {
        const prev = this.tabStates.get(this.lastActiveTabKey)!;
        if (prev.browser === browserName) {
          prev.isCurrentlyActive = false;
        }
      }
      this.lastActiveTabKey = currentActiveTabKey;
    }
  }

  /**
   * Fetches real open tab info from OS (AppleScript on macOS for Chrome/Safari,
   * with active-win fallback).
   */
  private fetchOpenTabsFromOS(
    browserName: string,
    activeWin: { title: string; url?: string }
  ): Array<{ tabId: string; url: string; title: string; isActive: boolean }> {
    if (process.platform === 'darwin') {
      const appleScriptTabs = this.fetchTabsAppleScript(browserName);
      if (appleScriptTabs.length > 0) {
        return appleScriptTabs;
      }
    }

    // Fallback: Use active window info when browser automation is unavailable
    const url = activeWin.url || '';
    if (!url || !/^https?:/i.test(url)) return [];

    let domain = '';
    try { domain = new URL(url).hostname; } catch { domain = 'unknown'; }

    // Use domain+url hash as stable fallback tabId
    const tabId = `tab_${domain}_${Buffer.from(url).toString('base64').slice(0, 12)}`;

    // Prevent background tabs from being closed in fallback mode by artificially keeping them alive
    const fallbackTabs: Array<{ tabId: string; url: string; title: string; isActive: boolean }> = [];
    for (const [key, tab] of this.tabStates.entries()) {
      if (tab.browser === browserName && tab.tabId !== tabId) {
        fallbackTabs.push({
          tabId: tab.tabId,
          url: tab.url,
          title: tab.pageTitle,
          isActive: false,
        });
      }
    }

    fallbackTabs.push({
      tabId,
      url,
      title: activeWin.title || 'Untitled',
      isActive: true,
    });

    return fallbackTabs;
  }

  /** AppleScript query for macOS Chrome / Safari tabs */
  private fetchTabsAppleScript(
    browserName: string
  ): Array<{ tabId: string; url: string; title: string; isActive: boolean }> {
    try {
      let script = '';
      if (browserName.includes('Chrome') || browserName.includes('Edge') || browserName.includes('Brave')) {
        script = `
          tell application "${browserName}"
            if not (exists window 1) then return ""
            set outputStr to ""
            repeat with w in windows
              repeat with t in tabs of w
                set isAct to (active tab of w is t)
                set outputStr to outputStr & (id of t as text) & "|||" & (URL of t as text) & "|||" & (title of t as text) & "|||" & (isAct as text) & "\\n"
              end repeat
            end repeat
            return outputStr
          end tell
        `;
      } else if (browserName.includes('Safari')) {
        script = `
          tell application "Safari"
            if not (exists window 1) then return ""
            set outputStr to ""
            repeat with w in windows
              repeat with t in tabs of w
                set isAct to (current tab of w is t)
                set outputStr to outputStr & (index of t as text) & "|||" & (URL of t as text) & "|||" & (name of t as text) & "|||" & (isAct as text) & "\\n"
              end repeat
            end repeat
            return outputStr
          end tell
        `;
      } else {
        return [];
      }

      const stdout = execSync(`osascript`, {
        input: script,
        timeout: 5000,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });

      const lines = stdout.trim().split('\n').filter(Boolean);
      const result: Array<{ tabId: string; url: string; title: string; isActive: boolean }> = [];

      for (const line of lines) {
        const parts = line.split('|||');
        if (parts.length >= 4) {
          const [idStr, url, title, isAct] = parts;
          if (idStr && url && /^https?:/i.test(url.trim())) {
            result.push({
              tabId:    idStr.trim(),
              url:      url.trim(),
              title:    (title || '').trim(),
              isActive: isAct?.trim() === 'true',
            });
          }
        }
      }

      return result;
    } catch {
      return [];
    }
  }

  /**
   * Closes a single tab, calculates duration = end_time - start_time, and emits CLOSE event.
   */
  private closeTab(tabKey: string, reason: 'TAB_CLOSE' | 'BROWSER_CLOSE'): void {
    const tab = this.tabStates.get(tabKey);
    if (!tab) return;

    this.tabStates.delete(tabKey);
    if (this.queue) {
      this.queue.deleteTabState(tabKey);
    }

    const endedAt  = nowIso();
    const duration = Math.round(
      (new Date(endedAt).getTime() - new Date(tab.startedAt).getTime()) / 1000
    );

    if (duration < 1) return;

    this.log.info(`[${reason}] tab closed`, {
      tabKey,
      tabId:         tab.tabId,
      browser:       tab.browser,
      domain:        tab.domain,
      url:           tab.url,
      startedAt:     tab.startedAt,
      endedAt,
      duration_seconds: duration,
      open_event_id: tab.openEventId,
      reason,
    });

    this.sink.push(EventType.BROWSER_ACTIVITY, {
      durationSeconds: duration,
      data: {
        action:           'CLOSE',
        open_event_id:    tab.openEventId,
        browser:          tab.browser,
        domain:           tab.domain,
        url:              tab.url,
        page_title:       tab.pageTitle || 'Untitled',
        started_at:       tab.startedAt,
        ended_at:         endedAt,
        duration_seconds: duration,
      },
    });
  }

  /** Closes all open tabs for a browser when the browser process closes */
  private closeBrowserTabs(browserName: string, reason: 'BROWSER_CLOSE'): void {
    const keysToClose: string[] = [];
    for (const [key, tab] of this.tabStates.entries()) {
      if (tab.browser === browserName) {
        keysToClose.push(key);
      }
    }

    if (keysToClose.length > 0) {
      this.log.info('[BROWSER_CLOSE] browser closed', {
        browser:         browserName,
        closedTabsCount: keysToClose.length,
      });
      for (const key of keysToClose) {
        this.closeTab(key, reason);
      }
    }
  }

  private closeSegment(): void {
    if (!this.segment) return;
    const endedAt  = nowIso();
    const duration = Math.round(
      (new Date(endedAt).getTime() - new Date(this.segment.startedAt).getTime()) / 1000
    );
    if (duration >= 1) {
      this.sink.push(EventType.APPLICATION_ACTIVITY, {
        durationSeconds: duration,
        data: {
          application: this.segment.application,
          process_id:  this.segment.process_id,
          started_at:  this.segment.startedAt,
          ended_at:    endedAt,
          date:        this.segment.startedAt.slice(0, 10),
        },
      });
    }
    this.segment = null;
  }
}
