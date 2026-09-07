const schemas = require('../../src/utils/schemas');

describe('validation schemas', () => {
  test('organizations.register rejects a short password', () => {
    const result = schemas.organizations.register.safeParse({
      organizationName: 'Acme',
      email: 'a@acme.com',
      password: 'short',
    });
    expect(result.success).toBe(false);
  });

  test('organizations.register accepts a valid payload', () => {
    const result = schemas.organizations.register.safeParse({
      organizationName: 'Acme',
      email: 'a@acme.com',
      password: 'a-fine-password',
    });
    expect(result.success).toBe(true);
  });

  test('agent.enroll requires organization_code, employee_id, device_id', () => {
    expect(schemas.agent.enroll.safeParse({}).success).toBe(false);
    expect(
      schemas.agent.enroll.safeParse({
        organization_code: 'ACME-123',
        employee_id: 'EMP-1',
        device_id: 'DEV-1',
      }).success
    ).toBe(true);
  });

  test('activity.browserActivity requires action to be OPEN or CLOSE', () => {
    const base = { browser: 'Chrome', domain: 'x.com', event_id: 'e1' };
    expect(schemas.activity.browserActivity.safeParse({ ...base, action: 'OPEN' }).success).toBe(true);
    expect(schemas.activity.browserActivity.safeParse({ ...base, action: 'PAUSE' }).success).toBe(false);
  });

  test('activity.batch requires at least one event and caps at 500', () => {
    expect(schemas.activity.batch.safeParse({ events: [] }).success).toBe(false);
    const oneEvent = { type: 'mouse', event_id: 'e1', data: {} };
    expect(schemas.activity.batch.safeParse({ events: [oneEvent] }).success).toBe(true);
    const tooMany = Array.from({ length: 501 }, (_, i) => ({ type: 'mouse', event_id: `e${i}`, data: {} }));
    expect(schemas.activity.batch.safeParse({ events: tooMany }).success).toBe(false);
  });

  test('employees.list defaults skip/take and coerces query-string numbers', () => {
    const result = schemas.employees.list.parse({});
    expect(result).toEqual({ skip: 0, take: 50 });
    const result2 = schemas.employees.list.parse({ skip: '10', take: '5' });
    expect(result2).toEqual({ skip: 10, take: 5 });
  });
});
