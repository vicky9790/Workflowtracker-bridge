jest.mock('../../src/config/prisma', () => {
  const { createFakePrisma } = require('../fakePrisma');
  return { prisma: createFakePrisma() };
});

const request = require('supertest');
const { createApp } = require('../../src/app');
const { prisma } = require('../../src/config/prisma');
const { env } = require('../../src/config/env');
const { logger } = require('../../src/config/logger');

const app = createApp();

describe('Creator Integration - Employee Activation API', () => {
  let orgAId, orgBId, employeeAId, employeeBId, adminAToken;
  const validKey = env.TRACKFLOW_INTEGRATION_KEY || 'test-integration-key';

  beforeAll(async () => {
    // 1. Create Organization A & Employee A
    const regA = await request(app).post('/api/organizations/register').send({
      organizationName: 'Creator Org A',
      email: 'admin_a@creator-test.local',
      password: 'StrongPassword123!',
    });
    orgAId = regA.body.data.organization.id;
    adminAToken = regA.body.data.token;

    const empA = await request(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        employeeCode: 'EMP-001',
        fullName: 'Employee One',
        email: 'emp1@creator-test.local',
      });
    employeeAId = empA.body.data.id;

    // 2. Create Organization B & Employee B
    const regB = await request(app).post('/api/organizations/register').send({
      organizationName: 'Creator Org B',
      email: 'admin_b@creator-test.local',
      password: 'StrongPassword123!',
    });
    orgBId = regB.body.data.organization.id;
    const adminBToken = regB.body.data.token;

    const empB = await request(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${adminBToken}`)
      .send({
        employeeCode: 'EMP-002',
        fullName: 'Employee Two',
        email: 'emp2@creator-test.local',
      });
    employeeBId = empB.body.data.id;
  });

  test('valid Creator integration request generates activation code', async () => {
    const res = await request(app)
      .post(`/api/integrations/creator/employees/${employeeAId}/activation`)
      .set('X-TrackFlow-Integration-Key', validKey)
      .send({ organizationId: orgAId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('activation_code');
    expect(res.body.data).toHaveProperty('activation_id');
    expect(res.body.data).toHaveProperty('expires_at');
    expect(res.body.data.employee_id).toBe('EMP-001');
    expect(res.body.data.activation_code).toMatch(/^TF-[0-9A-Z]{4}-[0-9A-Z]{4}$/);

    // Verify code in DB is hashed and status is ACTIVE
    const dbCode = await prisma.activationCode.findUnique({
      where: { id: res.body.data.activation_id },
    });
    expect(dbCode).toBeDefined();
    expect(dbCode.status).toBe('ACTIVE');
    expect(dbCode.codeHash).toHaveLength(64);
    // Plaintext code is never stored in DB
    expect(dbCode.code).toBeUndefined();
    expect(dbCode.activation_code).toBeUndefined();
  });

  test('invalid integration key is rejected with 401', async () => {
    // Missing key
    const missingRes = await request(app)
      .post(`/api/integrations/creator/employees/${employeeAId}/activation`)
      .send({ organizationId: orgAId });
    expect(missingRes.status).toBe(401);
    expect(missingRes.body.error.code).toBe('UNAUTHORIZED');

    // Wrong key
    const wrongRes = await request(app)
      .post(`/api/integrations/creator/employees/${employeeAId}/activation`)
      .set('X-TrackFlow-Integration-Key', 'invalid-key-value')
      .send({ organizationId: orgAId });
    expect(wrongRes.status).toBe(401);
    expect(wrongRes.body.error.code).toBe('UNAUTHORIZED');

    // Admin JWT cannot authenticate the integration endpoint
    const jwtRes = await request(app)
      .post(`/api/integrations/creator/employees/${employeeAId}/activation`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ organizationId: orgAId });
    expect(jwtRes.status).toBe(401);
  });

  test('employee not found returns 404', async () => {
    const nonExistentEmployeeId = '11111111-2222-3333-4444-555555555555';
    const res = await request(app)
      .post(`/api/integrations/creator/employees/${nonExistentEmployeeId}/activation`)
      .set('X-TrackFlow-Integration-Key', validKey)
      .send({ organizationId: orgAId });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('employee from another organization is rejected with 404', async () => {
    // Employee B belongs to Org B, calling with Org A's id must fail
    const res = await request(app)
      .post(`/api/integrations/creator/employees/${employeeBId}/activation`)
      .set('X-TrackFlow-Integration-Key', validKey)
      .send({ organizationId: orgAId });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('organization not found returns 404', async () => {
    const nonExistentOrgId = '99999999-8888-7777-6666-555555555555';
    const res = await request(app)
      .post(`/api/integrations/creator/employees/${employeeAId}/activation`)
      .set('X-TrackFlow-Integration-Key', validKey)
      .send({ organizationId: nonExistentOrgId });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('previous active code is revoked upon generating a new code', async () => {
    // 1. Issue first code
    const firstRes = await request(app)
      .post(`/api/integrations/creator/employees/${employeeAId}/activation`)
      .set('X-TrackFlow-Integration-Key', validKey)
      .send({ organizationId: orgAId });

    expect(firstRes.status).toBe(200);
    const firstCodeId = firstRes.body.data.activation_id;

    // Verify first code is ACTIVE
    let firstCodeDb = await prisma.activationCode.findUnique({
      where: { id: firstCodeId },
    });
    expect(firstCodeDb.status).toBe('ACTIVE');

    // 2. Issue second code for the same employee
    const secondRes = await request(app)
      .post(`/api/integrations/creator/employees/${employeeAId}/activation`)
      .set('X-TrackFlow-Integration-Key', validKey)
      .send({ organizationId: orgAId });

    expect(secondRes.status).toBe(200);
    const secondCodeId = secondRes.body.data.activation_id;
    expect(secondCodeId).not.toBe(firstCodeId);

    // Verify first code is now REVOKED
    firstCodeDb = await prisma.activationCode.findUnique({
      where: { id: firstCodeId },
    });
    expect(firstCodeDb.status).toBe('REVOKED');

    // Verify second code is ACTIVE
    const secondCodeDb = await prisma.activationCode.findUnique({
      where: { id: secondCodeId },
    });
    expect(secondCodeDb.status).toBe('ACTIVE');
  });

  test('plaintext code is never logged', async () => {
    const logSpy = jest.spyOn(logger, 'info');
    const warnSpy = jest.spyOn(logger, 'warn');
    const errorSpy = jest.spyOn(logger, 'error');

    const res = await request(app)
      .post(`/api/integrations/creator/employees/${employeeAId}/activation`)
      .set('X-TrackFlow-Integration-Key', validKey)
      .send({ organizationId: orgAId });

    expect(res.status).toBe(200);
    const issuedCode = res.body.data.activation_code;

    // Inspect all log calls
    const allCalls = [...logSpy.mock.calls, ...warnSpy.mock.calls, ...errorSpy.mock.calls];
    for (const call of allCalls) {
      const serialized = JSON.stringify(call);
      expect(serialized).not.toContain(issuedCode);
    }

    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test('preserves existing /api/employees/:id/activation endpoint with admin JWT', async () => {
    const res = await request(app)
      .post(`/api/employees/${employeeAId}/activation`)
      .set('Authorization', `Bearer ${adminAToken}`);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('activation_code');
    expect(res.body.data.employee_id).toBe('EMP-001');
  });
});
