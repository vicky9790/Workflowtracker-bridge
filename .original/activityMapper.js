/**
 * Maps an internal activity event to the Zoho Creator custom API function
 * that records it, and the exact flat parameter names that function
 * expects. These match the reference organization's already-deployed
 * Deluge functions field-for-field (work_session, browser_activity,
 * keyboard_metrics, mouse_metrics, application_usage, screenshot_upload) -
 * see docs/ZOHO_SETUP.md for the contract a new organization's Zoho
 * Creator app needs to implement to be compatible.
 *
 * device_id/employee_id are always the organization's own identifiers
 * (Device.deviceCode / Employee.employeeCode) - the same strings their
 * Zoho employee_profile/device_registry records were created with. The
 * Deluge function resolves the lookup field from that string server-side,
 * exactly as it already does today.
 */

const ENDPOINT_BY_TYPE = {
  work_session: 'work_session',
  browser_activity: 'browser_activity',
  keyboard_metrics: 'keyboard_metrics',
  mouse_metrics: 'mouse_metrics',
  application_usage: 'application_usage',
  screenshot: 'screenshot_upload',
  screenshot_upload: 'screenshot_upload',
  device_register: 'device_register',
};

function endpointForEventType(eventType) {
  return ENDPOINT_BY_TYPE[eventType] || 'activity_batch';
}

function buildParams(eventType, { deviceCode, employeeCode, data }) {
  const base = { device_id: deviceCode, employee_id: employeeCode };

  switch (eventType) {
    case 'work_session':
      return {
        ...base,
        session_id: data.session_id,
        action: data.action,
        login_time: data.login_time,
        logout_time: data.logout_time,
        total_duration: data.total_duration,
        active_duration: data.active_duration,
        idle_duration: data.idle_duration,
        session_status: data.session_status,
        session_date: data.session_date,
        notes: data.notes,
      };

    case 'browser_activity':
      return {
        ...base,
        browser: data.browser,
        domain: data.domain,
        url: data.url,
        page_title: data.page_title,
        start_time: data.start_time,
        end_time: data.end_time,
        duration_seconds: data.duration_seconds,
        action: data.action,
        event_id: data.event_id,
        open_event_id: data.open_event_id,
      };

    case 'keyboard_metrics':
      return {
        ...base,
        keystroke_count: data.keystroke_count,
        active_duration: data.active_duration,
        timestamp: data.timestamp,
      };

    case 'mouse_metrics':
      return {
        ...base,
        click_count: data.click_count,
        movement_events: data.movement_events,
        scroll_events: data.scroll_events,
        active_duration: data.active_duration,
        timestamp: data.timestamp,
      };

    case 'application_usage':
      return {
        ...base,
        application_name: data.application_name,
        start_time: data.start_time,
        end_time: data.end_time,
        duration_seconds: data.duration_seconds,
      };

    case 'screenshot':
    case 'screenshot_upload':
      return {
        ...base,
        timestamp: data.timestamp,
        screenshot_file: data.screenshot_file,
        session_id: data.session_id,
        capture_reason: data.capture_reason,
        privacy_status: data.privacy_status,
      };

    case 'device_register':
      return {
        ...base,
        device_name: data.device_name,
        operating_system: data.operating_system,
        os_version: data.os_version,
        agent_version: data.agent_version,
      };

    default:
      // Anything not in the map above still gets recorded, via the
      // general-purpose activity_batch function, instead of being
      // silently dropped.
      return { ...base, activity_data: JSON.stringify(data), timestamp: data.timestamp };
  }
}

module.exports = { endpointForEventType, buildParams };
