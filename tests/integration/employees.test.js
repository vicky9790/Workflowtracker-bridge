jest.mock('../../src/config/prisma', () => {
  const { createFakePrisma } = require('../fakePrisma');
  return { prisma: createFakePrisma() };
});

const request = require('supertest');
const { createApp } = require('../../src/app');

const app = createApp();

async function registerOrg(email) {
  const res = await request(app)
    .post('/api/organizations/register')
    .send({ organizationName: `Org for ${email}`, email, password: 'a-strong-password' });
  return { token: res.body.data.token, organizationId: res.body.data.organization.id };
}

describe('POST /api/employees', () => {
  test('an ORG_ADMIN can create an employee in their own organization', async () => {
    const { token } = await registerOrg('emp-owner@acme.test');
    const res = await request(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${token}`)
      .send({ employeeCode: 'EMP-001', fullName: 'Vignesh' });
    expect(res.status).toBe(201);
    expect(res.body.data.employeeCode).toBe('EMP-001');
    expect(res.body.data.status).toBe('ACTIVE');
  });

  test('rejects a duplicate employeeCode within the same organization', async () => {
    const { token } = await registerOrg('emp-dup@acme.test');
    await request(app).post('/api/employees').set('Authorization', `Bearer ${token}`).send({ employeeCode: 'EMP-001', fullName: 'First' });
    const res = await request(app).post('/api/employees').set('Authorization', `Bearer ${token}`).send({ employeeCode: 'EMP-001', fullName: 'Second' });
    expect(res.status).toBe(409);
  });

  test('rejects requests with no admin token', async () => {
    const res = await request(app).post('/api/employees').send({ employeeCode: 'EMP-001', fullName: 'Nobody' });
    expect(res.status).toBe(401);
  });
});

describe('tenant isolation', () => {
  test('an employeeCode can be reused across different organizations without colliding', async () => {
    const orgA = await registerOrg('tenant-a@acme.test');
    const orgB = await registerOrg('tenant-b@acme.test');

    const resA = await request(app).post('/api/employees').set('Authorization', `Bearer ${orgA.token}`).send({ employeeCode: 'EMP-100', fullName: 'A Employee' });
    const resB = await request(app).post('/api/employees').set('Authorization', `Bearer ${orgB.token}`).send({ employeeCode: 'EMP-100', fullName: 'B Employee' });

    expect(resA.status).toBe(201);
    expect(resB.status).toBe(201);
    expect(resA.body.data.id).not.toBe(resB.body.data.id);
  });

  test('an ORG_ADMIN from org A cannot fetch an employee belonging to org B by ID', async () => {
    const orgA = await registerOrg('leak-a@acme.test');
    const orgB = await registerOrg('leak-b@acme.test');

    const created = await request(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${orgB.token}`)
      .send({ employeeCode: 'EMP-SECRET', fullName: 'Confidential' });
    const employeeIdInOrgB = created.body.data.id;

    const leakAttempt = await request(app)
      .get(`/api/employees/${employeeIdInOrgB}`)
      .set('Authorization', `Bearer ${orgA.token}`);

    expect(leakAttempt.status).toBe(404); // not "403 forbidden" - org A should not even learn the record exists
  });

  test("org A's employee list never includes org B's employees", async () => {
    const orgA = await registerOrg('list-a@acme.test');
    const orgB = await registerOrg('list-b@acme.test');

    await request(app).post('/api/employees').set('Authorization', `Bearer ${orgA.token}`).send({ employeeCode: 'A-1', fullName: 'A One' });
    await request(app).post('/api/employees').set('Authorization', `Bearer ${orgB.token}`).send({ employeeCode: 'B-1', fullName: 'B One' });
    await request(app).post('/api/employees').set('Authorization', `Bearer ${orgB.token}`).send({ employeeCode: 'B-2', fullName: 'B Two' });

    const listA = await request(app).get('/api/employees').set('Authorization', `Bearer ${orgA.token}`);
    expect(listA.body.data.total).toBe(1);
    expect(listA.body.data.items.map((e) => e.employeeCode)).toEqual(['A-1']);
  });
});
