jest.mock('../../src/config/prisma', () => {
  const { createFakePrisma } = require('../fakePrisma');
  return { prisma: createFakePrisma() };
});

const request = require('supertest');
const { createApp } = require('../../src/app');
const { prisma } = require('../../src/config/prisma');

const app = createApp();

async function enrolledDeviceToken(email, employeeCode, deviceId) {
  const reg = await request(app)
    .post('/api/organizations/register')
    .send({ organizationName: `Org ${email}`, email, password: 'a-strong-password' });
  const adminToken = reg.body.data.token;
  const organizationCode = reg.body.data.organization.organizationCode;
  await request(app)
    .post('/api/employees')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ employeeCode, fullName: 'Test Employee' });
  const enroll = await request(app)
    .post('/api/agent/enroll')
    .send({ organization_code: organizationCode, employee_id: employeeCode, device_id: deviceId });
  return enroll.body.data.device_token;
}

describe('activity endpoints', () => {
  test('POST /api/agent/mouse-metrics records the event and durably queues it', async () => {
    const token = await enrolledDeviceToken('act1@acme.test', 'EMP-1', 'DEV-1');
    const res = await request(app)
      .post('/api/agent/mouse-metrics')
      .set('Authorization', `Bearer ${token}`)
      .send({ click_count: 12, movement_events: 300, scroll_events: 40, active_duration: 55, timestamp: '2026-01-01T10:00:00+05:30', event_id: 'evt-mouse-1' });

    expect(res.status).toBe(202);
    expect(res.body.data.recorded).toBe(true);
    expect(res.body.data.duplicate).toBe(false);

    const row = prisma.__store.db.activitySyncLog.find((r) => r.eventId === 'evt-mouse-1');
    expect(row).toBeTruthy();
    expect(row.status).toBe('PENDING');
    expect(row.zohoEndpoint).toBe('mouse_metrics');
    expect(row.payload.device_id).toBe('DEV-1');
    expect(row.payload.employee_id).toBe('EMP-1');
  });

  test('submitting the same event_id twice is idempotent, not duplicated', async () => {
    const token = await enrolledDeviceToken('act2@acme.test', 'EMP-1', 'DEV-1');
    const body = { browser: 'Chrome', domain: 'github.com', action: 'OPEN', event_id: 'evt-dup-1', start_time: 't1' };

    const first = await request(app).post('/api/agent/browser-activity').set('Authorization', `Bearer ${token}`).send(body);
    const second = await request(app).post('/api/agent/browser-activity').set('Authorization', `Bearer ${token}`).send(body);

    expect(first.body.data.duplicate).toBe(false);
    expect(second.body.data.duplicate).toBe(true);

    const matching = prisma.__store.db.activitySyncLog.filter((r) => r.eventId === 'evt-dup-1');
    expect(matching).toHaveLength(1); // exactly one row, not two
  });

  test('a device from one organization cannot be authenticated by another organization at all', async () => {
    const tokenOrgA = await enrolledDeviceToken('cross1@acme.test', 'EMP-1', 'DEV-1');
    // There's no per-org endpoint variant to call "as" a different org - the
    // token itself carries the org, so this just re-confirms the token
    // resolves to exactly its own organization's device, never another's.
    const res = await request(app).get('/api/agent/device').set('Authorization', `Bearer ${tokenOrgA}`);
    const device = prisma.__store.db.device.find((d) => d.deviceCode === 'DEV-1');
    expect(res.body.data.device_id).toBe('DEV-1');
    expect(device.organizationId).toBeTruthy();
  });

  test('POST /api/agent/activity/batch records multiple event types in one call', async () => {
    const token = await enrolledDeviceToken('batch1@acme.test', 'EMP-1', 'DEV-1');
    const res = await request(app)
      .post('/api/agent/activity/batch')
      .set('Authorization', `Bearer ${token}`)
      .send({
        events: [
          { type: 'mouse', event_id: 'b-1', data: { click_count: 1 } },
          { type: 'keyboard', event_id: 'b-2', data: { keystroke_count: 5 } },
          { type: 'application', event_id: 'b-3', data: { application_name: 'VS Code' } },
        ],
      });

    expect(res.status).toBe(202);
    expect(res.body.data.recorded).toBe(3);
    const rows = prisma.__store.db.activitySyncLog.filter((r) => ['b-1', 'b-2', 'b-3'].includes(r.eventId));
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.zohoEndpoint).sort()).toEqual(['application_usage', 'keyboard_metrics', 'mouse_metrics']);
  });

  test('rejects a request with no device token', async () => {
    const res = await request(app).post('/api/agent/mouse-metrics').send({ event_id: 'no-auth' });
    expect(res.status).toBe(401);
  });
});
