jest.mock('../../src/config/prisma', () => {
  const { createFakePrisma } = require('../fakePrisma');
  return { prisma: createFakePrisma() };
});
jest.mock('../../src/services/zoho/zohoService', () => ({
  forOrganization: () => ({ callCustomFunction: jest.fn().mockResolvedValue({ success: true, record_id: 'zoho-rec-1' }) }),
}));

const request = require('supertest');
const { createApp } = require('../../src/app');
const app = createApp();

async function setupOrgWithDevice(email, employeeCode, deviceId) {
  const reg = await request(app)
    .post('/api/organizations/register')
    .send({ organizationName: `Org ${email}`, email, password: 'a-strong-password' });
  const token = reg.body.data.token;
  const organizationCode = reg.body.data.organization.organizationCode;
  await request(app).post('/api/employees').set('Authorization', `Bearer ${token}`).send({ employeeCode, fullName: 'Test Employee' });
  const enroll = await request(app)
    .post('/api/agent/enroll')
    .send({ organization_code: organizationCode, employee_id: employeeCode, device_id: deviceId, agent_version: '1.0.0' });
  return { token, organizationCode, deviceToken: enroll.body.data.device_token };
}

describe('GET /api/devices', () => {
  test('lists devices for the caller\'s own organization, including the employee they belong to', async () => {
    const { token } = await setupOrgWithDevice('dev-list@acme.test', 'EMP-1', 'DEV-1');
    const res = await request(app).get('/api/devices').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.items[0].deviceCode).toBe('DEV-1');
    expect(res.body.data.items[0].employee.employeeCode).toBe('EMP-1');
  });

  test('tenant isolation: org A never sees org B devices', async () => {
    await setupOrgWithDevice('dev-iso-a@acme.test', 'EMP-1', 'DEV-A');
    const orgB = await setupOrgWithDevice('dev-iso-b@acme.test', 'EMP-1', 'DEV-B');
    const res = await request(app).get('/api/devices').set('Authorization', `Bearer ${orgB.token}`);
    expect(res.body.data.items.map((d) => d.deviceCode)).toEqual(['DEV-B']);
  });
});

describe('PATCH /api/devices/:id/status', () => {
  test('disables a device, which then blocks that device\'s own token from authenticating', async () => {
    const { token, deviceToken } = await setupOrgWithDevice('dev-disable@acme.test', 'EMP-1', 'DEV-1');
    const list = await request(app).get('/api/devices').set('Authorization', `Bearer ${token}`);
    const deviceId = list.body.data.items[0].id;

    const disable = await request(app)
      .patch(`/api/devices/${deviceId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'DISABLED' });
    expect(disable.status).toBe(200);
    expect(disable.body.data.status).toBe('DISABLED');

    const blocked = await request(app).get('/api/agent/device').set('Authorization', `Bearer ${deviceToken}`);
    expect(blocked.status).toBe(403);
  });

  test('a device id from another organization is 404, not editable', async () => {
    const orgA = await setupOrgWithDevice('dev-cross-a@acme.test', 'EMP-1', 'DEV-1');
    const orgB = await setupOrgWithDevice('dev-cross-b@acme.test', 'EMP-1', 'DEV-1');
    const listA = await request(app).get('/api/devices').set('Authorization', `Bearer ${orgA.token}`);
    const deviceIdInA = listA.body.data.items[0].id;

    const res = await request(app)
      .patch(`/api/devices/${deviceIdInA}/status`)
      .set('Authorization', `Bearer ${orgB.token}`)
      .send({ status: 'DISABLED' });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/devices/:id/revoke-token', () => {
  test('revokes the device\'s token without disabling the device itself', async () => {
    const { token, deviceToken } = await setupOrgWithDevice('dev-revoke@acme.test', 'EMP-1', 'DEV-1');
    const list = await request(app).get('/api/devices').set('Authorization', `Bearer ${token}`);
    const deviceId = list.body.data.items[0].id;

    const revoke = await request(app).post(`/api/devices/${deviceId}/revoke-token`).set('Authorization', `Bearer ${token}`);
    expect(revoke.status).toBe(200);
    expect(revoke.body.data.revoked).toBe(1);

    const oldTokenBlocked = await request(app).get('/api/agent/device').set('Authorization', `Bearer ${deviceToken}`);
    expect(oldTokenBlocked.status).toBe(401);

    // Device record itself is untouched, still ONLINE, re-enrollment (not this endpoint) is how it gets a new token.
    const stillListed = await request(app).get('/api/devices').set('Authorization', `Bearer ${token}`);
    expect(stillListed.body.data.items[0].status).toBe('ONLINE');
  });
});

describe('PATCH /api/employees/:id', () => {
  test('edits employee fields', async () => {
    const { token } = await setupOrgWithDevice('emp-edit@acme.test', 'EMP-1', 'DEV-1');
    const list = await request(app).get('/api/employees').set('Authorization', `Bearer ${token}`);
    const employeeId = list.body.data.items[0].id;

    const res = await request(app)
      .patch(`/api/employees/${employeeId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ department: 'Engineering', designation: 'Senior Developer' });
    expect(res.status).toBe(200);
    expect(res.body.data.department).toBe('Engineering');
  });

  test('disables an employee', async () => {
    const { token } = await setupOrgWithDevice('emp-disable@acme.test', 'EMP-1', 'DEV-1');
    const list = await request(app).get('/api/employees').set('Authorization', `Bearer ${token}`);
    const employeeId = list.body.data.items[0].id;

    const res = await request(app)
      .patch(`/api/employees/${employeeId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'DISABLED' });
    expect(res.body.data.status).toBe('DISABLED');

    // A disabled employee can no longer be used to enroll a NEW device.
    const orgCodeRes = await request(app).get('/api/organizations/me').set('Authorization', `Bearer ${token}`);
    const newEnroll = await request(app).post('/api/agent/enroll').send({
      organization_code: orgCodeRes.body.data.organizationCode,
      employee_id: 'EMP-1',
      device_id: 'DEV-NEW',
    });
    expect(newEnroll.status).toBe(403);
  });

  test('an employee id from another organization is 404', async () => {
    const orgA = await setupOrgWithDevice('emp-cross-a@acme.test', 'EMP-1', 'DEV-1');
    const orgB = await setupOrgWithDevice('emp-cross-b@acme.test', 'EMP-1', 'DEV-1');
    const listA = await request(app).get('/api/employees').set('Authorization', `Bearer ${orgA.token}`);
    const res = await request(app)
      .patch(`/api/employees/${listA.body.data.items[0].id}`)
      .set('Authorization', `Bearer ${orgB.token}`)
      .send({ fullName: 'Hijacked' });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/sync/logs', () => {
  test('lists this organization\'s own sync log rows, newest first, with device+employee attached', async () => {
    const { token, deviceToken } = await setupOrgWithDevice('sync-logs@acme.test', 'EMP-1', 'DEV-1');
    await request(app)
      .post('/api/agent/mouse-metrics')
      .set('Authorization', `Bearer ${deviceToken}`)
      .send({ click_count: 1, active_duration: 5, timestamp: 't', event_id: 'e1' });
    await request(app)
      .post('/api/agent/keyboard-metrics')
      .set('Authorization', `Bearer ${deviceToken}`)
      .send({ keystroke_count: 1, active_duration: 5, timestamp: 't', event_id: 'e2' });

    const res = await request(app).get('/api/sync/logs').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    // 3, not 2: enrollment itself durably queues a device_register push to
    // Zoho (see enrollmentService.js), on top of the two explicit events below.
    expect(res.body.data.total).toBe(3);
    expect(res.body.data.items[0].device.deviceCode).toBe('DEV-1');
    expect(res.body.data.items[0].device.employee.employeeCode).toBe('EMP-1');
  });

  test('status filter works and tenant isolation holds', async () => {
    const orgA = await setupOrgWithDevice('sync-filter-a@acme.test', 'EMP-1', 'DEV-1');
    const orgB = await setupOrgWithDevice('sync-filter-b@acme.test', 'EMP-1', 'DEV-1');
    await request(app)
      .post('/api/agent/mouse-metrics')
      .set('Authorization', `Bearer ${orgB.deviceToken}`)
      .send({ click_count: 1, event_id: 'b-1' });

    const resA = await request(app).get('/api/sync/logs?status=PENDING').set('Authorization', `Bearer ${orgA.token}`);
    expect(resA.body.data.total).toBe(1); // org A's own setup enrollment queued one device_register row

    const resB = await request(app).get('/api/sync/logs?status=PENDING').set('Authorization', `Bearer ${orgB.token}`);
    expect(resB.body.data.total).toBe(2); // org B's setup enrollment + the mouse-metrics event above
  });
});

describe('organization self-service', () => {
  test('GET /api/organizations/me returns the caller\'s own organization', async () => {
    const { token } = await setupOrgWithDevice('org-me@acme.test', 'EMP-1', 'DEV-1');
    const res = await request(app).get('/api/organizations/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.organizationName).toBe('Org org-me@acme.test');
  });

  test('PATCH /api/organizations/me renames the organization', async () => {
    const { token } = await setupOrgWithDevice('org-rename@acme.test', 'EMP-1', 'DEV-1');
    const res = await request(app)
      .patch('/api/organizations/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ organizationName: 'Renamed Inc' });
    expect(res.status).toBe(200);
    expect(res.body.data.organizationName).toBe('Renamed Inc');

    const check = await request(app).get('/api/organizations/me').set('Authorization', `Bearer ${token}`);
    expect(check.body.data.organizationName).toBe('Renamed Inc');
  });
});
