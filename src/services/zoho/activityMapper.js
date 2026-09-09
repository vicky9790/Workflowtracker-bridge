/**
 * Maps an internal activity event onto a Zoho Creator form write.
 *
 * REWRITTEN 06-Sep-2026 against the live Creator schema (see
 * creatorSchema.js). The previous version invented parameter names that do
 * not exist on any form in the application - `browser`, `duration_seconds`,
 * `action`, `event_id`, `open_event_id` - and omitted the ones the
 * dashboard actually filters on (`activity_date`, `usage_date`,
 * `metric_date`) plus every per-form idempotency key (`activity_id`,
 * `usage_id`, `metric_id`, `session_id`, `screenshot_id`).
 *
 * Each mapper returns:
 *   { form, recordKey, lookups, data, files? }
 *
 *   form       - Creator form link name to write to
 *   recordKey  - { field, value } used to find-or-update instead of
 *                blind-inserting, which is what stops retries duplicating
 *   lookups    - business codes still needing resolution to record IDs
 *   data       - flat object of REAL field link names
 *   files      - deferred uploads (Creator file fields need a second call)
 *
 * Lookup fields stay as the business code here (employee_id / device_id
 * string). creatorWriter.js resolves them to Creator record IDs
 * immediately before the write, because a lookup field (type 14) rejects
 * anything that is not a record ID.
 */

const { coercePicklist } = require('./creatorSchema');

// Creator's dd-MMM-yyyy expects exactly these three-letter abbreviations.
// Intl's `month: 'short'` renders September as "Sept" in en-GB (and
// localises everything else), which Creator rejects outright - so the
// month is mapped explicitly rather than formatted.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Creator date-time fields want `dd-MMM-yyyy HH:mm:ss` in the app timezone. */
function toCreatorDateTime(iso, timeZone) {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: timeZone || 'UTC',
    day: '2-digit', month: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(d).reduce((acc, x) => ({ ...acc, [x.type]: x.value }), {});
  const mon = MONTHS[Number(p.month) - 1];
  return `${p.day}-${mon}-${p.year} ${p.hour}:${p.minute}:${p.second}`;
}

/** Creator date fields want `dd-MMM-yyyy`. */
function toCreatorDate(iso, timeZone) {
  const dt = toCreatorDateTime(iso, timeZone);
  return dt ? dt.split(' ')[0] : undefined;
}

/**
 * Derive the reporting date from the event's own timestamp in the
 * organization timezone, never from the server clock. The Creator app is
 * currently set to America/Los_Angeles while the operator is in
 * Asia/Kolkata; deriving the day server-side put events on the wrong
 * calendar date, which is why "today" on the dashboard showed yesterday.
 */
function reportingDate(primaryIso, timeZone) {
  return toCreatorDate(primaryIso, timeZone);
}

function num(v) {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Parameter names and value shapes that carry credentials. Mirrors the
 * Agent's own sanitizer deliberately: Agents already in the field send raw
 * URLs, and the browser_activity report currently holds live Salesforce,
 * Google and Microsoft credentials because nothing stripped them. Doing it
 * here as well means no Agent version can write a secret into Creator.
 */
const SENSITIVE_PARAMS = new Set([
  'access_token', 'auth', 'authorization', 'apikey', 'api_key',
  'client_secret', 'code', 'credential', 'id_token', 'jwt', 'key',
  'login_hint', 'nonce', 'oauth_token', 'part', 'password', 'pwd',
  'refresh_token', 'secret', 'session', 'sessionid', 'sig', 'signature',
  'source', 'state', 'ticket', 'token', 'authuser', 'email', 'user',
  'username', 'continue', 'redirect_uri',
]);
const SENSITIVE_FRAGMENTS = ['token', 'secret', 'passw', 'auth', 'cred', 'session'];

function sanitizeUrl(raw) {
  if (!raw) return undefined;
  let u;
  try {
    u = new URL(String(raw));
  } catch {
    return String(raw).split('?')[0].split('#')[0].slice(0, 2048);
  }
  u.username = '';
  u.password = '';
  u.hash = '';
  for (const k of Array.from(u.searchParams.keys())) {
    const lower = k.toLowerCase();
    const v = u.searchParams.get(k) || '';
    const secretish = v.length >= 40 && !/\s/.test(v) && /^[A-Za-z0-9_\-+/=.%]+$/.test(v);
    if (SENSITIVE_PARAMS.has(lower) || SENSITIVE_FRAGMENTS.some((f) => lower.includes(f)) || secretish) {
      u.searchParams.set(k, '__redacted__');
    }
  }
  return u.toString().slice(0, 2048);
}

function urlField(raw) {
  const clean = sanitizeUrl(raw);
  if (!clean) return undefined;
  // Creator type 17 URL fields take an object, not a bare string.
  return { url: clean.slice(0, 65_535) };
}

/** Drops empty keys so an update never blanks an existing Creator value. */
function compact(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  }
  return out;
}

/**
 * @param eventType internal event type
 * @param ctx       { deviceCode, employeeCode, data, timeZone }
 */
function mapEvent(eventType, { deviceCode, employeeCode, data = {}, timeZone } = {}) {
  const tz = timeZone || 'Asia/Kolkata';
  const lookups = { employee: employeeCode, device: deviceCode };

  switch (eventType) {
    case 'work_session': {
      const login = data.login_time || data.started_at;
      const logout = data.logout_time || data.ended_at;
      return {
        form: 'work_session',
        recordKey: { field: 'session_id', value: data.session_id },
        lookups,
        data: compact({
          session_id: data.session_id,
          login_time: toCreatorDateTime(login, tz),
          logout_time: toCreatorDateTime(logout, tz),
          total_duration: num(data.total_duration),
          active_duration: num(data.active_duration),
          idle_duration: num(data.idle_duration),
          session_status: coercePicklist('session_status', data.session_status),
          session_date: reportingDate(login, tz),
          notes: data.notes,
        }),
      };
    }

    case 'browser_activity': {
      const start = data.start_time || data.started_at;
      const end = data.end_time || data.ended_at;
      // The Agent's own OPEN event id is the stable key: the later CLOSE
      // carries the same open_event_id and must UPDATE this row with
      // end_time/duration rather than insert a second one. That is the fix
      // for the orphaned rows already in the app - many browser_activity
      // records currently have an empty end_time and duration 0.
      const key = data.open_event_id || data.activity_id || data.event_id;
      return {
        form: 'browser_activity',
        recordKey: { field: 'activity_id', value: key },
        lookups,
        data: compact({
          activity_id: key,
          browser_name: data.browser_name || data.browser,
          domain: data.domain,
          url: urlField(data.url),
          page_title: data.page_title,
          start_time: toCreatorDateTime(start, tz),
          end_time: toCreatorDateTime(end, tz),
          duration: num(data.duration ?? data.duration_seconds),
          activity_date: reportingDate(start, tz),
          category: data.category,
          productivity_classification: coercePicklist(
            'productivity_classification', data.productivity_classification
          ),
        }),
      };
    }

    case 'application_usage': {
      const start = data.start_time || data.started_at;
      const key = data.usage_id || data.event_id;
      return {
        form: 'application_usage',
        recordKey: { field: 'usage_id', value: key },
        lookups,
        data: compact({
          usage_id: key,
          application_name: data.application_name || data.application,
          start_time: toCreatorDateTime(start, tz),
          end_time: toCreatorDateTime(data.end_time || data.ended_at, tz),
          duration: num(data.duration ?? data.duration_seconds),
          usage_date: reportingDate(start, tz),
          category: data.category,
          productivity_classification: coercePicklist(
            'productivity_classification', data.productivity_classification
          ),
        }),
      };
    }

    case 'keyboard_metrics': {
      const key = data.metric_id || data.event_id;
      return {
        form: 'keyboard_metrics',
        recordKey: { field: 'metric_id', value: key },
        lookups,
        data: compact({
          metric_id: key,
          timestamp: toCreatorDateTime(data.timestamp, tz),
          metric_date: reportingDate(data.timestamp, tz),
          keystroke_count: num(data.keystroke_count),
          active_duration: num(data.active_duration),
        }),
      };
    }

    case 'mouse_metrics': {
      const key = data.metric_id || data.event_id;
      return {
        form: 'mouse_metrics',
        recordKey: { field: 'metric_id', value: key },
        lookups,
        data: compact({
          metric_id: key,
          timestamp: toCreatorDateTime(data.timestamp, tz),
          metric_date: reportingDate(data.timestamp, tz),
          click_count: num(data.click_count),
          movement_events: num(data.movement_events),
          scroll_events: num(data.scroll_events),
          active_duration: num(data.active_duration),
        }),
      };
    }

    case 'screenshot':
    case 'screenshot_upload': {
      const key = data.screenshot_id || data.event_id;
      const isUrl = typeof data.screenshot_file === 'string' && (
        data.screenshot_file.startsWith('http://') ||
        data.screenshot_file.startsWith('https://')
      );
      return {
        form: 'screenshot_record',
        recordKey: { field: 'screenshot_id', value: key },
        lookups: compact({ ...lookups, session: data.session_id || undefined }),
        data: compact({
          screenshot_id: key,
          timestamp: toCreatorDateTime(data.timestamp, tz),
          capture_reason: data.capture_reason,
          privacy_status: coercePicklist('privacy_status', data.privacy_status),
        }),
        files: data.screenshot_file
          ? [{
            field: 'screenshot_file',
            ...(isUrl ? { url: data.screenshot_file } : { base64: data.screenshot_file }),
            fileName: data.screenshot_filename || `${key}.png`,
          }]
          : [],
      };
    }

    case 'device_register': {
      const now = new Date().toISOString();
      return {
        form: 'device_registry',
        recordKey: { field: 'device_id', value: deviceCode },
        lookups: { employee: employeeCode },
        data: compact({
          device_id: deviceCode,
          // Previously sent as device_name/operating_system but the live
          // record has both blank while os_version and agent_version
          // landed - the old Deluge function was reading hostname/os.
          // Writing the form directly removes the guesswork entirely.
          device_name: data.device_name || data.hostname,
          operating_system: data.operating_system || data.os,
          os_version: data.os_version,
          ip_address: data.ip_address,
          agent_version: data.agent_version,
          registration_date: toCreatorDate(data.registered_at || now, tz),
          device_status: coercePicklist('device_status', data.device_status || 'ONLINE'),
          monitoring_status: coercePicklist(
            'monitoring_status', data.monitoring_status || 'ENABLED'
          ),
          last_heartbeat: toCreatorDateTime(data.last_heartbeat || now, tz),
          last_active_time: toCreatorDateTime(data.last_active_time || now, tz),
        }),
      };
    }

    case 'device_heartbeat': {
      const ts = data.timestamp || new Date().toISOString();
      const key = data.heartbeat_id || data.event_id;
      return {
        form: 'device_heartbeat',
        recordKey: { field: 'heartbeat_id', value: key },
        lookups,
        data: compact({
          heartbeat_id: key,
          timestamp: toCreatorDateTime(ts, tz),
          agent_version: data.agent_version,
          ip_address: data.ip_address,
          system_status: data.system_status || data.status,
          activity_status: data.activity_status,
        }),
      };
    }

    default:
      // Unknown types land in activity_log rather than vanishing, but we
      // no longer pretend an `activity_batch` custom function exists.
      return {
        form: 'activity_log',
        recordKey: { field: 'activity_id', value: data.event_id },
        lookups,
        data: compact({
          activity_id: data.event_id,
          activity_type: eventType,
          timestamp: toCreatorDateTime(data.timestamp, tz),
        }),
      };
  }
}

/** Retained for the sync_log.zohoEndpoint column and existing dashboards. */
function endpointForEventType(eventType) {
  return mapEvent(eventType, { deviceCode: '', employeeCode: '', data: {} }).form;
}

module.exports = { mapEvent, endpointForEventType, toCreatorDateTime, toCreatorDate, sanitizeUrl };
