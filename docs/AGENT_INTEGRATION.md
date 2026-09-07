# Electron Agent integration - exact changes required

**Status: applied and verified.** Every change below has been made in the
actual Agent checkout, `npm run typecheck` and the Agent's own `vitest`
suite (14 tests) both pass clean, and `scripts/agent-bridge-contract-test.js`
in this project drives the real compiled Agent client against a real
running Bridge instance end to end (enroll -> device token -> heartbeat ->
browser activity OPEN/CLOSE -> work session, plus the invalid-org-code and
disabled-device rejection paths) - see the README for how to re-run it
yourself. What follows is kept as the exact record of what changed and why.

Everything below was checked against the real Agent source (the copy you
shared, extracted at `trackflow-agent/`), not written from a generic
template. It touches only the "API/sync destination" layer, exactly the
scope your own instructions called out - nothing in `src/agent/*`
(browser, application, keyboard, mouse, work-session, screenshot
collection, idle detection), `src/database/*` (the SQLite queue/batching),
or `browser-extension/*` changes at all.

**Confirmed by reading the full file, not by inference:**
`src/creator/sync/syncManager.ts` calls
`this.client.post(\`/${endpoint}\`, payload)` where `endpoint` is one of
the snake_case names below (`work_session`, `browser_activity`, etc.),
produced by `payloadMapper.ts`'s `getEndpointForEventType()`. That whole
file needs **zero changes** - the URL-building and response-parsing logic
it depends on is entirely inside `client.ts`, which is exactly the one
file this diff rewrites.

**Not independently confirmed:** whether `src/agent/heartbeat/heartbeat.ts`
calls `client.post('/device_heartbeat', ...)` with the same pattern - I
did not read that file's contents directly. Grep it for `client.post`
before assuming no further change is needed there; if it follows the same
convention as every other call site in this codebase (which is likely,
given how consistent the rest of it is), it needs no change either, for
the same reason `syncManager.ts` doesn't.

`device_status`, `employee_config`, and `sync_status` are declared in the
old `client.ts`'s endpoint table but I found no call site actually
invoking them anywhere in `src/`. If nothing calls them, no Bridge-side
handling is needed for them at all; if you do find a call site, they'd
map to `GET /api/agent/device`, `GET /api/employees/:id` (admin-scoped,
not something the Agent should call directly), and `GET /api/sync/status`
respectively - none of which exist as Agent-facing POST endpoints on the
Bridge today.

---

## 1. `.env`

Replace the 12 per-endpoint URLs and `TRACKFLOW_DC` with one base URL.
Replace `TRACKFLOW_ENROLLMENT_TOKEN` (which the Agent overloaded to carry
both `employee_id` and `enrollment_token` as the same value) with two
separate, explicitly-named values, matching what enrollment now actually
asks for.

```diff
- TRACKFLOW_ENROLLMENT_TOKEN=...
- TRACKFLOW_URL_DEVICE_REGISTER=...
- TRACKFLOW_URL_DEVICE_HEARTBEAT=...
- TRACKFLOW_URL_ACTIVITY_BATCH=...
- TRACKFLOW_URL_WORK_SESSION=...
- TRACKFLOW_URL_APPLICATION_USAGE=...
- TRACKFLOW_URL_BROWSER_ACTIVITY=...
- TRACKFLOW_URL_KEYBOARD_METRICS=...
- TRACKFLOW_URL_MOUSE_METRICS=...
- TRACKFLOW_URL_SCREENSHOT_UPLOAD=...
- TRACKFLOW_URL_DEVICE_STATUS=...
- TRACKFLOW_URL_EMPLOYEE_CONFIG=...
- TRACKFLOW_URL_SYNC_STATUS=...
- TRACKFLOW_DC=in
+ TRACKFLOW_API_BASE_URL=https://api.myproduct.com
+ TRACKFLOW_ORG_CODE=ACME01-3F2A1B
+ TRACKFLOW_EMPLOYEE_ID=EMP-001
```

`TRACKFLOW_ORG_CODE`/`TRACKFLOW_EMPLOYEE_ID` are exactly the "Organization
Code" and "Employee ID" your installer flow already says it will ask the
employee for.

## 2. `src/config/schema.ts`

```diff
- export interface ApiUrls {
-   deviceRegister: string;
-   deviceHeartbeat: string;
-   activityBatch: string;
-   workSession: string;
-   applicationUsage: string;
-   browserActivity: string;
-   keyboardMetrics: string;
-   mouseMetrics: string;
-   screenshotUpload: string;
-   deviceStatus: string;
-   employeeConfig: string;
-   syncStatus: string;
- }
-
  export interface AppConfig {
    env: 'production' | 'development' | 'test';

-   enrollmentToken: string;
-   apiUrls: ApiUrls;
-   dc: string;
+   organizationCode: string;
+   employeeId: string;
+   apiBaseUrl: string;

    heartbeatIntervalMs: number;
    ...
```

Everything else in `schema.ts` (`RemoteSettings` etc.) is unchanged.

## 3. `src/config/config.ts`

```diff
  export function loadBaseConfig(): AppConfig {
    const env = (process.env.TRACKFLOW_ENV as AppConfig['env']) || 'production';
    return {
      env,
-     enrollmentToken: str('TRACKFLOW_ENROLLMENT_TOKEN'),
-     apiUrls: {
-       deviceRegister:   str('TRACKFLOW_URL_DEVICE_REGISTER'),
-       deviceHeartbeat:  str('TRACKFLOW_URL_DEVICE_HEARTBEAT'),
-       activityBatch:    str('TRACKFLOW_URL_ACTIVITY_BATCH'),
-       workSession:      str('TRACKFLOW_URL_WORK_SESSION'),
-       applicationUsage: str('TRACKFLOW_URL_APPLICATION_USAGE'),
-       browserActivity:  str('TRACKFLOW_URL_BROWSER_ACTIVITY'),
-       keyboardMetrics:  str('TRACKFLOW_URL_KEYBOARD_METRICS'),
-       mouseMetrics:     str('TRACKFLOW_URL_MOUSE_METRICS'),
-       screenshotUpload: str('TRACKFLOW_URL_SCREENSHOT_UPLOAD'),
-       deviceStatus:     str('TRACKFLOW_URL_DEVICE_STATUS'),
-       employeeConfig:   str('TRACKFLOW_URL_EMPLOYEE_CONFIG'),
-       syncStatus:       str('TRACKFLOW_URL_SYNC_STATUS'),
-     },
-     dc: str('TRACKFLOW_DC', 'in'),
+     organizationCode: str('TRACKFLOW_ORG_CODE'),
+     employeeId: str('TRACKFLOW_EMPLOYEE_ID'),
+     apiBaseUrl: str('TRACKFLOW_API_BASE_URL'),

      heartbeatIntervalMs: num('TRACKFLOW_HEARTBEAT_INTERVAL_MS', 300_000),
      ...
```

Nothing else in `config.ts` changes - `applyRemoteSettings`,
`persistRemoteSettings`, `readPersistedRemoteSettings` are untouched.

## 4. `src/creator/api/client.ts` (full replacement)

The URL-per-endpoint lookup becomes one base URL plus a route-segment
table, and the Zoho-envelope response unwrapping (`code === 3000`, a
nested stringified `.result`) becomes a plain `{success, data}` /
`{success: false, error}` parse - the Bridge's own response shape,
documented in `docs/API.md` of the Bridge project. `ApiError`,
`AuthProvider`, the timeout/abort handling, and the quota-check block are
all unchanged.

```typescript
import { Logger } from '../../logging/logger';
import { QuotaManager } from './quotaManager';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retriable: boolean,
    readonly body?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface AuthProvider {
  headers(): Record<string, string>;
  deviceId(): string;
}

export interface CreatorClientOptions {
  apiBaseUrl: string;
  timeoutMs?: number;
  logger: Logger;
  quotaManager?: QuotaManager;
}

/**
 * Centralized HTTP client for the Bridge Backend. Thin: it maps status
 * codes to typed errors and marks which are retriable. Backoff/retry
 * policy is owned by the sync layer so the queue stays the single
 * scheduler - unchanged from the direct-to-Zoho version.
 *
 * The Bridge uses one bearer device token for every call (issued at
 * enrollment) rather than Zoho's per-endpoint public-key URLs, so there
 * is one base URL plus a route segment per event type instead of twelve
 * separate configured URLs.
 */
export class CreatorClient {
  private timeoutMs: number;

  /** Internal event-type name -> Bridge route segment, appended to
   *  `${apiBaseUrl}/api/agent/`. */
  private static readonly PATH_TO_ROUTE: Record<string, string> = {
    device_register: 'enroll',
    device_heartbeat: 'heartbeat',
    activity_batch: 'activity/batch',
    work_session: 'work-session',
    application_usage: 'application-usage',
    browser_activity: 'browser-activity',
    keyboard_metrics: 'keyboard-metrics',
    mouse_metrics: 'mouse-metrics',
    screenshot_upload: 'screenshot',
  };

  constructor(private opts: CreatorClientOptions, private auth: AuthProvider) {
    this.timeoutMs = opts.timeoutMs ?? 15_000;
  }

  async post<T = unknown>(pathName: string, body: unknown, options?: { isCritical?: boolean }): Promise<T> {
    const apiName = pathName.replace(/^\//, '').replace(/\//g, '_');
    const route = CreatorClient.PATH_TO_ROUTE[apiName];

    if (!route) {
      throw new ApiError(`No Bridge route configured for ${apiName}`, 500, false);
    }
    const url = `${this.opts.apiBaseUrl.replace(/\/$/, '')}/api/agent/${route}`;

    if (this.opts.quotaManager && !this.opts.quotaManager.canMakeCall(options?.isCritical)) {
      const metrics = this.opts.quotaManager.getMetrics();
      this.opts.logger.warn('[API QUOTA EXCEEDED] Daily call budget reached or low buffer active', {
        apiName,
        callsToday: metrics.callsToday,
        remainingQuota: metrics.remainingQuota,
        resetsAt: metrics.resetsAt,
        isCritical: options?.isCritical ?? false,
      });
      throw new ApiError('Daily API quota exceeded', 429, true);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Id': this.auth.deviceId(),
          ...this.auth.headers(),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (this.opts.quotaManager) {
        this.opts.quotaManager.recordCall(apiName);
      }

      const text = await res.text();
      const parsed = text ? safeJson(text) : undefined;

      if (res.status === 200 || res.status === 201 || res.status === 202) {
        const envelope = parsed as { success?: boolean; data?: unknown; error?: { code: string; message: string } } | undefined;
        this.opts.logger.debug('Bridge API response', { api: apiName, status: res.status, body: envelope });

        if (envelope && envelope.success === false) {
          // The Bridge accepted the HTTP call but rejected it logically
          // (validation, tenant checks) - shouldn't normally happen for
          // a 2xx status, but don't silently treat it as success if it does.
          throw new ApiError(envelope.error?.message || 'Bridge reported failure', 400, false, envelope);
        }
        return (envelope?.data !== undefined ? envelope.data : parsed) as T;
      }

      const errBody = parsed as { error?: { code: string; message: string } } | undefined;
      const message = errBody?.error?.message;

      if (res.status === 400) throw new ApiError(message || 'Validation error', 400, false, parsed);
      if (res.status === 401 || res.status === 403) throw new ApiError(message || 'Authentication failed', res.status, false, parsed);
      if (res.status === 404) throw new ApiError(message || 'Not found', 404, false, parsed);
      if (res.status === 409) throw new ApiError(message || 'Conflict', 409, false, parsed);
      if (res.status === 429) throw new ApiError(message || 'Rate limited', 429, true, parsed);
      if (res.status >= 500) throw new ApiError(message || 'Server error', res.status, true, parsed);
      throw new ApiError(message || `Unexpected status ${res.status}`, res.status, false, parsed);
    } catch (err) {
      if (err instanceof ApiError) throw err;
      const msg = err instanceof Error ? err.message : 'network error';
      throw new ApiError(msg, 0, true);
    } finally {
      clearTimeout(timer);
    }
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
```

## 5. `src/creator/auth/deviceAuth.ts`

One line added to the registration payload (`organization_code` -
required by the Bridge's `/api/agent/enroll`, which didn't exist as a
concept in the direct-to-Zoho version) and the overloaded
`enrollmentToken` field replaced by the two now-separate config values.
Everything else in this file - the `AuthProvider` implementation, the
credential-store load/save logic, `ensureRegistered()`'s overall
structure - is unchanged.

```diff
    const info = collectDeviceInfo();
    const client = makeClient(this);
    const res = await client.post<RegisterResponse>('/device/register', {
      device_id: deviceId,
      hostname: info.hostname,
      os: info.os,
      os_version: info.os_version,
      arch: info.arch,
      agent_version: info.agent_version,
-     employee_id: this.cfg.enrollmentToken || undefined,
-     enrollment_token: this.cfg.enrollmentToken || undefined,
+     organization_code: this.cfg.organizationCode,
+     employee_id: this.cfg.employeeId,
    });
```

## 6. `src/main/main.ts`

One line, where the client is constructed:

```diff
- const client = new CreatorClient({ apiUrls: cfg.apiUrls, logger: log, quotaManager: quota }, auth);
+ const client = new CreatorClient({ apiBaseUrl: cfg.apiBaseUrl, logger: log, quotaManager: quota }, auth);
```

## Files confirmed to need no changes

- `src/creator/sync/syncManager.ts` - calls `client.post(\`/${endpoint}\`, payload)` with the same snake_case names either way; verified by reading the full file.
- `src/creator/sync/payloadMapper.ts` - builds the same flat payloads regardless of transport; verified by reading the full file.
- `src/database/eventQueue.ts`, `src/database/db.ts`, `src/database/migrations.ts` - the local SQLite queue doesn't know or care where events eventually go.
- Everything in `src/agent/*` (browser, application, keyboard, mouse, idle, sessions, screenshots) and `browser-extension/*` - no monitoring/collection logic changes at all, exactly as instructed.
