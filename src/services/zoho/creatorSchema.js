/**
 * VERIFIED Zoho Creator schema for "Workforce Activity Intelligence System".
 *
 * Every link name, field type and picklist value below was read back from
 * the live application through the Creator metadata API
 * (getForms / getFormMetadata) on 06-Sep-2026. Nothing here is assumed.
 *
 * Field type codes returned by Creator that matter to us:
 *   1  single line       2  multi line        3  email
 *   5  number           10  date             11  date-time
 *  12  picklist (radio/dropdown, allow_other_choice)
 *  13  picklist (multi) 14  LOOKUP -> needs a Creator record ID, not a code
 *  16  checkbox         17  file/URL upload  29  name (composite subfields)
 *
 * The two traps this file exists to stop us falling into again:
 *
 *  a) LOOKUP fields (type 14) will NOT accept "EMP-001". They need the
 *     Creator record ID (e.g. "416852000000172006"). Anything that writes
 *     employee/device/session must resolve the code to an ID first.
 *
 *  b) Picklists are Title Case in Creator ("Online", "Active", "Enabled").
 *     The Bridge and Agent both use SCREAMING_CASE internally. The live
 *     device_registry row currently holds device_status "ONLINE" and
 *     monitoring_status "ACTIVE" - neither is a valid choice; they only
 *     saved because allow_other_choice is true. Coerce on the way out.
 */

const APP_LINK_NAME = 'workforce-activity-intelligence-system';

/** form link name -> report link name, for reads and lookup resolution. */
const REPORTS = {
  employee_profile: 'employee_profile_Report',
  device_registry: 'device_registry_Report',
  work_session: 'work_session_Report',
  browser_activity: 'browser_activity_Report',
  application_usage: 'application_usage_Report',
  keyboard_metrics: 'keyboard_metrics_Report',
  mouse_metrics: 'mouse_metrics_Report',
  screenshot_record: 'screenshot_record_Report',
  device_heartbeat: 'device_heartbeat_Report',
  alert_record: 'alert_record_Report',
  activity_log: 'activity_log_Report',
  monitoring_settings: 'monitoring_settings_Report',
};

/**
 * Picklist coercion. Key is the field link name; value maps any casing we
 * might produce onto the exact choice string Creator accepts.
 */
const PICKLISTS = {
  device_status: {
    ONLINE: 'Online',
    OFFLINE: 'Offline',
    IDLE: 'Idle',
  },
  monitoring_status: {
    ENABLED: 'Enabled',
    DISABLED: 'Disabled',
    // The Agent has historically sent ACTIVE/INACTIVE here.
    ACTIVE: 'Enabled',
    INACTIVE: 'Disabled',
  },
  session_status: {
    ACTIVE: 'Active',
    COMPLETED: 'Completed',
    INTERRUPTED: 'Interrupted',
  },
  employment_status: {
    ACTIVE: 'Active',
    RESIGNED: 'Resigned',
    PROBATION: 'Probation',
    ON_LEAVE: 'On Leave',
    INACTIVE: 'Resigned',
  },
  privacy_status: {
    PRIVATE: 'Private',
    PUBLIC: 'Public',
    PAUSED: 'Paused',
  },
  productivity_classification: {
    HIGH: 'High',
    MEDIUM: 'Medium',
    LOW: 'Low',
    NEUTRAL: 'Neutral',
  },
};

function coercePicklist(fieldLinkName, value) {
  if (value === undefined || value === null || value === '') return undefined;
  const table = PICKLISTS[fieldLinkName];
  if (!table) return value;
  const key = String(value).trim().toUpperCase().replace(/[\s-]+/g, '_');
  return table[key] ?? value;
}

/**
 * Per-form contract. `lookups` names the fields that must be resolved from
 * a business code to a Creator record ID before the write; `idField` is the
 * form's own idempotency key so a retry updates rather than duplicates.
 */
const FORMS = {
  employee_profile: {
    idField: 'employee_id',
    lookups: {},
    // employee_name is type 29 (composite). A bare string is rejected.
    nameFields: ['employee_name', 'manager_name'],
    fields: [
      'employee_id', 'employee_name', 'email', 'department',
      'designation1', 'manager_name', 'employment_status',
      'monitoring_enabled', 'joining_date',
    ],
  },

  device_registry: {
    idField: 'device_id',
    lookups: { employee: 'employee_profile' },
    fields: [
      'device_id', 'employee', 'device_name', 'operating_system',
      'os_version', 'ip_address', 'agent_version', 'registration_date',
      'last_heartbeat', 'device_status', 'last_active_time', 'monitoring_status',
    ],
  },

  work_session: {
    idField: 'session_id',
    lookups: { employee: 'employee_profile', device: 'device_registry' },
    fields: [
      'session_id', 'employee', 'device', 'login_time', 'logout_time',
      'total_duration', 'active_duration', 'idle_duration',
      'session_status', 'session_date', 'notes',
    ],
  },

  browser_activity: {
    idField: 'activity_id',
    lookups: { employee: 'employee_profile', device: 'device_registry' },
    urlFields: ['url'], // type 17 - must be sent as { "url": "..." }
    fields: [
      'activity_id', 'employee', 'device', 'browser_name', 'domain', 'url',
      'page_title', 'start_time', 'end_time', 'duration', 'activity_date',
      'category', 'productivity_classification',
    ],
  },

  application_usage: {
    idField: 'usage_id',
    lookups: { employee: 'employee_profile', device: 'device_registry' },
    fields: [
      'usage_id', 'employee', 'device', 'application_name', 'start_time',
      'end_time', 'duration', 'usage_date', 'category',
      'productivity_classification',
    ],
  },

  keyboard_metrics: {
    idField: 'metric_id',
    lookups: { employee: 'employee_profile', device: 'device_registry' },
    fields: [
      'metric_id', 'employee', 'device', 'timestamp', 'metric_date',
      'keystroke_count', 'active_duration',
    ],
  },

  mouse_metrics: {
    idField: 'metric_id',
    lookups: { employee: 'employee_profile', device: 'device_registry' },
    fields: [
      'metric_id', 'employee', 'device', 'timestamp', 'metric_date',
      'click_count', 'movement_events', 'scroll_events', 'active_duration',
    ],
  },

  screenshot_record: {
    idField: 'screenshot_id',
    lookups: {
      employee: 'employee_profile',
      device: 'device_registry',
      session: 'work_session',
    },
    // screenshot_file is type 17 with target 1: an actual file upload.
    // It cannot be populated in the same call that creates the record -
    // create first, then POST the bytes to the upload endpoint.
    fileFields: ['screenshot_file'],
    fields: [
      'screenshot_id', 'employee', 'device', 'timestamp',
      'session', 'capture_reason', 'privacy_status',
    ],
  },

  device_heartbeat: {
    idField: 'heartbeat_id',
    lookups: { employee: 'employee_profile', device: 'device_registry' },
    fields: [
      'heartbeat_id', 'employee', 'device', 'timestamp', 'agent_version',
      'ip_address', 'system_status', 'activity_status',
    ],
  },
};

module.exports = {
  APP_LINK_NAME,
  FORMS,
  REPORTS,
  PICKLISTS,
  coercePicklist,
};
