jest.mock('../../src/config/prisma', () => {
  const { createFakePrisma } = require('../fakePrisma');
  return { prisma: createFakePrisma() };
});

const request = require('supertest');
const { createApp } = require('../../src/app');

const app = createApp();

describe('POST /api/organizations/register', () => {
  test('creates an organization and its first ORG_ADMIN, returns a usable token', async () => {
    const res = await request(app).post('/api/organizations/register').send({
      organizationName: 'Acme Workforce',
      email: 'admin@acme.test',
      password: 'a-strong-password',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.organization.organizationCode).toMatch(/^[A-Z0-9]+-[A-F0-9]+$/i);
    expect(res.body.data.admin.role).toBe('ORG_ADMIN');
    expect(typeof res.body.data.token).toBe('string');
  });

  test('rejects a second registration with the same email', async () => {
    await request(app).post('/api/organizations/register').send({
      organizationName: 'Dup Co',
      email: 'dup@acme.test',
      password: 'a-strong-password',
    });
    const res = await request(app).post('/api/organizations/register').send({
      organizationName: 'Dup Co Again',
      email: 'dup@acme.test',
      password: 'a-strong-password',
    });
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  test('rejects a malformed request body (validation)', async () => {
    const res = await request(app).post('/api/organizations/register').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });
});

describe('POST /api/organizations/login', () => {
  async function registerOrg(email) {
    await request(app).post('/api/organizations/register').send({
      organizationName: 'Login Test Co',
      email,
      password: 'correct-password',
    });
  }

  test('logs in with correct credentials', async () => {
    await registerOrg('login1@acme.test');
    const res = await request(app)
      .post('/api/organizations/login')
      .send({ email: 'login1@acme.test', password: 'correct-password' });
    expect(res.status).toBe(200);
    expect(res.body.data.admin.email).toBe('login1@acme.test');
    expect(typeof res.body.data.token).toBe('string');
  });

  test('rejects an incorrect password without revealing which field was wrong', async () => {
    await registerOrg('login2@acme.test');
    const res = await request(app)
      .post('/api/organizations/login')
      .send({ email: 'login2@acme.test', password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid email or password');
  });

  test('rejects an unknown email with the same generic message', async () => {
    const res = await request(app)
      .post('/api/organizations/login')
      .send({ email: 'nobody@acme.test', password: 'whatever' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid email or password');
  });
});
