#!/usr/bin/env node
/**
 * Agent <-> Bridge contract test.
 *
 * Wires the REAL compiled Agent networking code (dist/creator/api/client.js
 * from your TrackFlow Agent checkout, built with `npm run build`, not
 * reimplemented or simulated here) against a REAL running instance of THIS
 * Bridge (src/app.js, also unmodified) over an actual HTTP socket. Confirms
 * end to end: enrollment issues a working device token, that token
 * authenticates heartbeat/activity calls, browser OPEN/CLOSE events link
 * correctly via open_event_id, every resulting row is scoped to the right
 * organization, an unknown organization_code is rejected as a real 404
 * ApiError (not silently swallowed), and a disabled device is rejected
 * with 403.
 *
 * Postgres is swapped for this project's own in-memory test fake
 * (tests/fakePrisma.js - see docs/TESTING.md for why) and Zoho itself is
 * mocked, so this proves the Agent<->Bridge leg specifically, without
 * needing a live database or a live Zoho account.
 *
 * Usage:
 *   node scripts/agent-bridge-contract-test.js /path/to/trackflow-agent
 *   AGENT_PROJECT_DIR=/path/to/trackflow-agent node scripts/agent-bridge-contract-test.js
 *
 * The Agent checkout must already be built (`npm run build` inside it) so
 * dist/creator/api/client.js and dist/logging/logger.js exist.
 */
const path = require('path');
const fs = require('fs');
const assert = require('assert');

const BRIDGE_DIR = path.resolve(__dirname, '..');
const AGENT_DIR = process.argv[2] || process.env.AGENT_PROJECT_DIR;

if (!AGENT_DIR) {
  console.error('Usage: node scripts/agent-bridge-contract-test.js /path/to/trackflow-agent');
  console.error('   or: AGENT_PROJECT_DIR=/path/to/trackflow-agent node scripts/agent-bridge-contract-test.js');
  process.exit(1);
}
const clientPath = path.join(AGENT_DIR, 'dist/creator/api/client.js');
if (!fs.existsSync(clientPath)) {
  console.error(`Not found: ${clientPath}`);
  console.error('Build the Agent first: cd ' + AGENT_DIR + ' && npm run build');
  process.exit(1);
}

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'contract-test-secret';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'c'.repeat(64);
process.env.ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID || 'x';
process.env.ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET || 'x';
process.env.ZOHO_REDIRECT_URI = process.env.ZOHO_REDIRECT_URI || 'https://x/x';
process.env.API_BASE_URL = process.env.API_BASE_URL || 'https://x';
process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_MAX = '10000';

function requireFromBridge(p) {
  return require(path.join(BRIDGE_DIR, p));
}
function requireFromAgent(p) {
  return require(path.join(AGENT_DIR, p));
}

// Swap Postgres for the fake and Zoho for a mock, exactly like this
// project's own test suite does, before requiring anything that uses them.
const { createFakePrisma } = requireFromBridge('tests/fakePrisma.js');
const fakePrisma = createFakePrisma();
require.cache[require.resolve(path.join(BRIDGE_DIR, 'src/config/prisma.js'))] = {
  id: 'prisma-stub', filename: 'prisma-stub', loaded: true,
  exports: { prisma: fakePrisma },
};
require.cache[require.resolve(path.join(BRIDGE_DIR, 'src/services/zoho/zohoService.js'))] = {
  id: 'zoho-stub', filename: 'zoho-stub', loaded: true,
  exports: { forOrganization: () => ({ callCustomFunction: async () => ({ success: true, record_id: 'zoho-rec' }) }) },
};

const { createApp } = requireFromBridge('src/app.js');
const { CreatorClient } = requireFromAgent('dist/creator/api/client.js');
const { Logger } = requireFromAgent('dist/logging/logger.js');

async function main() {
  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = server.address().port;
  const apiBaseUrl = `http://127.0.0.1:${port}`;
  console.log(`Bridge listening on ${apiBaseUrl}`);

  try {
    const registerRes = await fetch(`${apiBaseUrl}/api/organizations/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationName: 'Contract Test Org', email: `admin-${Date.now()}@contract-test.local`, password: 'a-strong-password' }),
    });
    const registerBody = await registerRes.json();
    assert.strictEqual(registerRes.status, 201, 'organization register should succeed');
    const adminToken = registerBody.data.token;
    const organizationCode = registerBody.data.organization.organizationCode;
    console.log(`Organization registered: ${organizationCode}`);

    const empRes = await fetch(`${apiBaseUrl}/api/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ employeeCode: 'EMP-001', fullName: 'Contract Test Employee' }),
    });
    assert.strictEqual(empRes.status, 201, 'employee create should succeed');
    console.log('Employee EMP-001 created');

    const bootstrapClient = new CreatorClient(
      { apiBaseUrl, logger: new Logger('error') },
      { headers: () => ({}), deviceId: () => 'contract-test-device' }
    );

    const enrollRes = await bootstrapClient.post('/device/register', {
      device_id: 'DEV-CONTRACT-1', hostname: 'contract-test-host', os: 'linux', os_version: '6.0', arch: 'x64',
      agent_version: '1.0.0-contract-test', organization_code: organizationCode, employee_id: 'EMP-001',
    });
    assert.ok(enrollRes.device_token, 'enroll response must include device_token');
    assert.strictEqual(enrollRes.employee_id, 'EMP-001');
    console.log("Agent enrolled via real CreatorClient.post('/device/register'), got device_token");

    const deviceToken = enrollRes.device_token;
    const authedClient = new CreatorClient(
      { apiBaseUrl, logger: new Logger('error') },
      { headers: () => ({ Authorization: `Bearer ${deviceToken}` }), deviceId: () => 'DEV-CONTRACT-1' }
    );

    await authedClient.post('/device_heartbeat', { status: 'ONLINE', agent_version: '1.0.0-contract-test' });
    console.log('Heartbeat accepted');

    await authedClient.post('/browser_activity', {
      browser: 'Chrome', domain: 'github.com', url: 'https://github.com', page_title: 'GitHub',
      start_time: '2026-01-01T09:00:00+05:30', end_time: '', duration_seconds: 0,
      action: 'OPEN', event_id: 'contract-evt-open-1',
    });
    await authedClient.post('/browser_activity', {
      browser: 'Chrome', domain: 'github.com', url: 'https://github.com', page_title: 'GitHub',
      start_time: '2026-01-01T09:00:00+05:30', end_time: '2026-01-01T09:05:00+05:30', duration_seconds: 300,
      action: 'CLOSE', event_id: 'contract-evt-close-1', open_event_id: 'contract-evt-open-1',
    });
    console.log('Browser activity OPEN + CLOSE accepted');

    await authedClient.post('/work_session', {
      session_id: 'contract-session-1', action: 'START', login_time: '2026-01-01T09:00:00+05:30',
      session_status: 'ACTIVE', session_date: '2026-01-01', event_id: 'contract-session-evt-1',
    });
    console.log('Work session accepted');

    const orgId = registerBody.data.organization.id;
    const logs = fakePrisma.__store.db.activitySyncLog.filter((r) => r.organizationId === orgId);
    const eventIds = logs.map((r) => r.eventId);
    assert.ok(eventIds.includes('contract-evt-open-1'), 'OPEN event queued');
    assert.ok(eventIds.includes('contract-evt-close-1'), 'CLOSE event queued');
    assert.ok(eventIds.includes('contract-session-evt-1'), 'session event queued');
    const closeRow = logs.find((r) => r.eventId === 'contract-evt-close-1');
    assert.strictEqual(closeRow.payload.open_event_id, 'contract-evt-open-1', 'CLOSE correctly references the OPEN event_id');
    assert.strictEqual(closeRow.payload.device_id, 'DEV-CONTRACT-1');
    assert.strictEqual(closeRow.payload.employee_id, 'EMP-001');
    console.log(`Verified ${logs.length} sync-log rows, all correctly scoped to organization ${orgId}`);

    let threw = false;
    try {
      await bootstrapClient.post('/device/register', {
        device_id: 'DEV-CONTRACT-BAD', organization_code: 'DOES-NOT-EXIST', employee_id: 'EMP-001',
      });
    } catch (err) {
      threw = true;
      assert.strictEqual(err.name, 'ApiError');
      assert.strictEqual(err.status, 404);
      assert.strictEqual(err.retriable, false);
    }
    assert.ok(threw, 'enrolling with an unknown organization_code must throw ApiError(404)');
    console.log('Invalid organization_code correctly rejected as ApiError(404, retriable=false)');

    const device = fakePrisma.__store.db.device.find((d) => d.deviceCode === 'DEV-CONTRACT-1');
    device.status = 'DISABLED';
    let deviceRejected = false;
    try {
      await authedClient.post('/device_heartbeat', { status: 'ONLINE' });
    } catch (err) {
      deviceRejected = true;
      assert.strictEqual(err.status, 403);
    }
    assert.ok(deviceRejected, 'a disabled device must be rejected');
    console.log('Disabled device correctly rejected as ApiError(403)');

    console.log('\nALL CONTRACT CHECKS PASSED');
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error('CONTRACT TEST FAILED:', err);
  process.exit(1);
});
