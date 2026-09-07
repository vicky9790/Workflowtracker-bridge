const { endpointForEventType, buildParams } = require('../../src/services/zoho/activityMapper');

describe('activityMapper', () => {
  test('endpointForEventType maps known types to their Deluge function name', () => {
    expect(endpointForEventType('work_session')).toBe('work_session');
    expect(endpointForEventType('browser_activity')).toBe('browser_activity');
    expect(endpointForEventType('keyboard_metrics')).toBe('keyboard_metrics');
    expect(endpointForEventType('mouse_metrics')).toBe('mouse_metrics');
    expect(endpointForEventType('application_usage')).toBe('application_usage');
    expect(endpointForEventType('screenshot')).toBe('screenshot_upload');
    expect(endpointForEventType('device_register')).toBe('device_register');
  });

  test('unknown event types fall back to activity_batch', () => {
    expect(endpointForEventType('something_new')).toBe('activity_batch');
  });

  test('buildParams always includes device_id and employee_id from the caller-supplied codes, not the raw event data', () => {
    const params = buildParams('keyboard_metrics', {
      deviceCode: 'DEV-1',
      employeeCode: 'EMP-1',
      data: { keystroke_count: 10, active_duration: 5, timestamp: '2026-01-01T00:00:00+05:30' },
    });
    expect(params.device_id).toBe('DEV-1');
    expect(params.employee_id).toBe('EMP-1');
    expect(params.keystroke_count).toBe(10);
  });

  test('browser_activity mapping preserves the OPEN/CLOSE event_id contract exactly', () => {
    const openParams = buildParams('browser_activity', {
      deviceCode: 'DEV-1',
      employeeCode: 'EMP-1',
      data: { browser: 'Chrome', domain: 'github.com', action: 'OPEN', event_id: 'evt-1', start_time: 't1' },
    });
    expect(openParams.action).toBe('OPEN');
    expect(openParams.event_id).toBe('evt-1');
    expect(openParams.open_event_id).toBeUndefined();

    const closeParams = buildParams('browser_activity', {
      deviceCode: 'DEV-1',
      employeeCode: 'EMP-1',
      data: { browser: 'Chrome', domain: 'github.com', action: 'CLOSE', event_id: 'evt-2', open_event_id: 'evt-1' },
    });
    expect(closeParams.action).toBe('CLOSE');
    expect(closeParams.open_event_id).toBe('evt-1');
  });

  test('unmapped event types still get recorded via activity_data, never silently dropped', () => {
    const params = buildParams('something_new', {
      deviceCode: 'DEV-1',
      employeeCode: 'EMP-1',
      data: { foo: 'bar' },
    });
    expect(params.activity_data).toBe(JSON.stringify({ foo: 'bar' }));
  });
});
