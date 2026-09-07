jest.mock('../../src/config/prisma', () => {
  const { createFakePrisma } = require('../fakePrisma');
  return { prisma: createFakePrisma() };
});
jest.mock('../../src/services/zoho/zohoService', () => ({
  forOrganization: () => ({
    callCustomFunction: jest.fn().mockResolvedValue({ success: true, record_id: 'zoho-rec-1' }),
  }),
}));

const request = require('supertest');
const { createApp } = require('../../src/app');
const { prisma } = require('../../src/config/prisma');

const app = createApp();

async function registerOrgAndEmployee(email, employeeCode) {
  const reg = await request(app)
    .post('/api/organizations/register')
    .send({ organizationName: `Org ${email}`, email, password: 'a-strong-password' });
  const token = reg.body.data.token;
  const organizationCode = reg.body.data.organization.organizationCode;
  await request(app)
    .post('/api/employees')
    .set('Authorization', `Bearer ${token}`)
    .send({ employeeCode, fullName: 'Test Employee' });
  return { token, organizationCode };
}

describe('POST /api/agent/enroll', () => {
  test("enrolls via activation code formatted as TF-ORG-EMP", async () => {
    const { organizationCode } = await registerOrgAndEmployee("actcode@acme.test", "EMP-ACT");
    const activationCode = `TF-${organizationCode}-EMP-ACT`;
    const res = await request(app).post("/api/agent/enroll").send({
      activation_code: activationCode,
      device_id: "DEVICE-ACT",
      hostname: "vignesh-mbp",
      os: "darwin",
      os_version: "15.6",
      agent_version: "1.0.0",
    });
    expect(res.status).toBe(201);
    expect(res.body.data.device_token).toHaveLength(64);
    expect(res.body.data.employee_name).toBe("Test Employee");
    expect(res.body.data.organization_code).toBe(organizationCode);
  });

  test("enrolls a new device and returns a device token", async () => {
    const { organizationCode } = await registerOrgAndEmployee('enroll1@acme.test', 'EMP-1');
    const res = await request(app).post('/api/agent/enroll').send({
      organization_code: organizationCode,
      employee_id: 'EMP-1',
      device_id: 'DEVICE-ABC',
      hostname: 'vignesh-mbp',
      os: 'darwin',
      os_version: '15.6',
      agent_version: '1.0.0',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.device_token).toHaveLength(64);
    expect(res.body.data.already_registered).toBe(false);
  });

  test('re-enrolling the same device_id is idempotent and issues a fresh token', async () => {
    const { organizationCode } = await registerOrgAndEmployee('enroll2@acme.test', 'EMP-1');
    const payload = {
      organization_code: organizationCode,
      employee_id: 'EMP-1',
      device_id: 'DEVICE-XYZ',
      agent_version: '1.0.0',
    };
    const first = await request(app).post('/api/agent/enroll').send(payload);
    const second = await request(app).post('/api/agent/enroll').send(payload);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.data.already_registered).toBe(true);
    expect(second.body.data.device_token).not.toBe(first.body.data.device_token);

    // The old token must actually stop working once re-enrollment revokes it.
    const oldTokenCheck = await request(app)
      .get('/api/agent/device')
      .set('Authorization', `Bearer ${first.body.data.device_token}`);
    expect(oldTokenCheck.status).toBe(401);

    const newTokenCheck = await request(app)
      .get('/api/agent/device')
      .set('Authorization', `Bearer ${second.body.data.device_token}`);
    expect(newTokenCheck.status).toBe(200);
  });

  test('invalid organization code is rejected', async () => {
    const res = await request(app).post('/api/agent/enroll').send({
      organization_code: 'DOES-NOT-EXIST',
      employee_id: 'EMP-1',
      device_id: 'DEVICE-1',
    });
    expect(res.status).toBe(404);
  });

  test('unknown employee_id within a real organization is rejected', async () => {
    const { organizationCode } = await registerOrgAndEmployee('enroll3@acme.test', 'EMP-1');
    const res = await request(app).post('/api/agent/enroll').send({
      organization_code: organizationCode,
      employee_id: 'EMP-NOT-REAL',
      device_id: 'DEVICE-1',
    });
    expect(res.status).toBe(404);
  });
});

describe('device authentication', () => {
  async function enrollDevice(email, employeeCode, deviceId) {
    const { organizationCode } = await registerOrgAndEmployee(email, employeeCode);
    const res = await request(app).post('/api/agent/enroll').send({
      organization_code: organizationCode,
      employee_id: employeeCode,
      device_id: deviceId,
    });
    return res.body.data.device_token;
  }

  test('a valid device token can call an agent-authenticated route', async () => {
    const token = await enrollDevice('auth1@acme.test', 'EMP-1', 'DEV-1');
    const res = await request(app).get('/api/agent/device').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.device_id).toBe('DEV-1');
  });

  test('missing Authorization header is rejected', async () => {
    const res = await request(app).get('/api/agent/device');
    expect(res.status).toBe(401);
  });

  test('a garbage token is rejected', async () => {
    const res = await request(app).get('/api/agent/device').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  test('a disabled device is forbidden even with a technically-valid token', async () => {
    const token = await enrollDevice('auth2@acme.test', 'EMP-1', 'DEV-DISABLED');

    // Flip the device to DISABLED directly in the fake store, the way an
    // admin action would via deviceRepository.setStatus in real usage.
    const device = prisma.__store.db.device.find((d) => d.deviceCode === 'DEV-DISABLED');
    device.status = 'DISABLED';

    const res = await request(app).get('/api/agent/device').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe('POST /api/agent/heartbeat', () => {
  test('updates last_seen and does not fail even though Zoho push is best-effort', async () => {
    const { organizationCode } = await registerOrgAndEmployee('hb1@acme.test', 'EMP-1');
    const enroll = await request(app).post('/api/agent/enroll').send({
      organization_code: organizationCode,
      employee_id: 'EMP-1',
      device_id: 'DEV-HB',
    });
    const token = enroll.body.data.device_token;

    const res = await request(app).post('/api/agent/heartbeat').set('Authorization', `Bearer ${token}`).send({ status: 'ONLINE' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ONLINE');
    expect(res.body.data.last_seen).toBeTruthy();
  });
});
