jest.mock('../../src/config/prisma', () => {
  const { createFakePrisma } = require('../fakePrisma');
  return { prisma: createFakePrisma() };
});
jest.mock('../../src/services/zoho/zohoOAuth', () => ({
  getAuthorizationUrl: jest.requireActual('../../src/services/zoho/zohoOAuth').getAuthorizationUrl,
  exchangeCodeForTokens: jest.fn().mockResolvedValue({
    accessToken: 'fake-access-token',
    refreshToken: 'fake-refresh-token',
    expiresInSeconds: 3600,
  }),
}));

const request = require('supertest');
const { createApp } = require('../../src/app');
const { prisma } = require('../../src/config/prisma');

const app = createApp();

async function registerOrgAdmin(email) {
  const res = await request(app)
    .post('/api/organizations/register')
    .send({ organizationName: `Org ${email}`, email, password: 'a-strong-password' });
  return { token: res.body.data.token, organizationId: res.body.data.organization.id };
}

describe('GET /api/zoho/connect', () => {
  test('requires admin auth', async () => {
    const res = await request(app).get('/api/zoho/connect?account_owner_name=acme&app_link_name=workforce');
    expect(res.status).toBe(401);
  });

  test('returns a Zoho authorization URL carrying a signed state', async () => {
    const { token } = await registerOrgAdmin('zoho1@acme.test');
    const res = await request(app)
      .get('/api/zoho/connect?account_owner_name=acme&app_link_name=workforce')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.authorization_url).toContain('accounts.zoho.in/oauth/v2/auth');
    expect(res.body.data.authorization_url).toContain('state=');
  });
});

describe('GET /api/zoho/callback', () => {
  test('completes the connection and is visible via /api/zoho/status', async () => {
    const { token, organizationId } = await registerOrgAdmin('zoho2@acme.test');
    const connect = await request(app)
      .get('/api/zoho/connect?account_owner_name=acme&app_link_name=workforce&data_center=in')
      .set('Authorization', `Bearer ${token}`);
    const state = new URL(connect.body.data.authorization_url).searchParams.get('state');

    const callback = await request(app).get('/api/zoho/callback').query({ code: 'auth-code-123', state });
    expect(callback.status).toBe(200);

    const conn = prisma.__store.db.zohoConnection.find((c) => c.organizationId === organizationId);
    expect(conn.status).toBe('CONNECTED');
    expect(conn.encryptedRefreshToken).not.toBe('fake-refresh-token'); // must be encrypted, not stored raw

    const status = await request(app).get('/api/zoho/status').set('Authorization', `Bearer ${token}`);
    expect(status.body.data.connected).toBe(true);
    expect(status.body.data.appLinkName).toBe('workforce');
  });

  test('rejects a tampered/invalid state', async () => {
    const res = await request(app).get('/api/zoho/callback').query({ code: 'x', state: 'not-a-real-jwt' });
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/zoho/disconnect', () => {
  test('clears the connection', async () => {
    const { token, organizationId } = await registerOrgAdmin('zoho3@acme.test');
    const connect = await request(app)
      .get('/api/zoho/connect?account_owner_name=acme&app_link_name=workforce')
      .set('Authorization', `Bearer ${token}`);
    const state = new URL(connect.body.data.authorization_url).searchParams.get('state');
    await request(app).get('/api/zoho/callback').query({ code: 'x', state });

    const disconnect = await request(app).delete('/api/zoho/disconnect').set('Authorization', `Bearer ${token}`);
    expect(disconnect.status).toBe(200);
    expect(disconnect.body.data.connected).toBe(false);

    const conn = prisma.__store.db.zohoConnection.find((c) => c.organizationId === organizationId);
    expect(conn.status).toBe('DISCONNECTED');
    expect(conn.encryptedRefreshToken).toBe('');
  });
});
