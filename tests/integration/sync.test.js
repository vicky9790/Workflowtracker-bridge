jest.mock('../../src/config/prisma', () => {
  const { createFakePrisma } = require('../fakePrisma');
  return { prisma: createFakePrisma() };
});

const { prisma } = require('../../src/config/prisma');
const syncLogRepository = require('../../src/models/syncLogRepository');

describe('retry worker', () => {
  async function seedOrgDeviceEmployee() {
    const org = await prisma.organization.create({ data: { organizationName: 'X', organizationCode: 'X-1', status: 'ACTIVE' } });
    const emp = await prisma.employee.create({ data: { organizationId: org.id, employeeCode: 'EMP-1', fullName: 'A', status: 'ACTIVE' } });
    const dev = await prisma.device.create({ data: { organizationId: org.id, employeeId: emp.id, deviceCode: 'DEV-1', status: 'ONLINE' } });
    await prisma.zohoConnection.create({
      data: { organizationId: org.id, accountOwnerName: 'owner', appLinkName: 'app', dataCenter: 'in', encryptedRefreshToken: 'irrelevant-for-mocked-zoho', status: 'CONNECTED' },
    });
    return { org, emp, dev };
  }

  test('a successful Zoho call marks the row SUCCESS and stores the returned record id', async () => {
    jest.doMock('../../src/services/zoho/zohoService', () => ({
      forOrganization: () => ({ callCustomFunction: jest.fn().mockResolvedValue({ result: JSON.stringify({ success: true, record_id: 'zoho-123' }) }) }),
    }));
    const retryWorker = require('../../src/services/sync/retryWorker');
    const { org, dev } = await seedOrgDeviceEmployee();
    const { row } = await syncLogRepository.upsertPending(org.id, {
      deviceId: dev.id, eventType: 'mouse_metrics', eventId: 'e1', zohoEndpoint: 'mouse_metrics', payload: { device_id: 'DEV-1' },
    });

    const result = await retryWorker.runOnce();
    expect(result.processed).toBe(1);

    const updated = prisma.__store.db.activitySyncLog.find((r) => r.id === row.id);
    expect(updated.status).toBe('SUCCESS');
    expect(updated.zohoRecordId).toBe('zoho-123');
    jest.dontMock('../../src/services/zoho/zohoService');
  });

  test('a retriable failure sets status FAILED with a future nextRetryAt, not DEAD', async () => {
    jest.resetModules();
    jest.doMock('../../src/services/zoho/zohoService', () => ({
      forOrganization: () => ({
        callCustomFunction: jest.fn().mockRejectedValue(Object.assign(new Error('Zoho is down'), { retriable: true, code: 'SERVICE_UNAVAILABLE' })),
      }),
    }));
    const { createFakePrisma } = require('../fakePrisma');
    const freshPrisma = createFakePrisma();
    jest.doMock('../../src/config/prisma', () => ({ prisma: freshPrisma }));
    const freshSyncLogRepository = require('../../src/models/syncLogRepository');
    const retryWorker = require('../../src/services/sync/retryWorker');

    const org = await freshPrisma.organization.create({ data: { organizationName: 'X', organizationCode: 'X-2', status: 'ACTIVE' } });
    const emp = await freshPrisma.employee.create({ data: { organizationId: org.id, employeeCode: 'EMP-1', fullName: 'A', status: 'ACTIVE' } });
    const dev = await freshPrisma.device.create({ data: { organizationId: org.id, employeeId: emp.id, deviceCode: 'DEV-1', status: 'ONLINE' } });
    const { row } = await freshSyncLogRepository.upsertPending(org.id, {
      deviceId: dev.id, eventType: 'mouse_metrics', eventId: 'e2', zohoEndpoint: 'mouse_metrics', payload: {},
    });

    await retryWorker.runOnce();

    const updated = freshPrisma.__store.db.activitySyncLog.find((r) => r.id === row.id);
    expect(updated.status).toBe('FAILED');
    expect(updated.attempts).toBe(1);
    expect(updated.nextRetryAt).toBeInstanceOf(Date);
    expect(updated.nextRetryAt.getTime()).toBeGreaterThan(Date.now());

    jest.dontMock('../../src/services/zoho/zohoService');
    jest.dontMock('../../src/config/prisma');
  });

  test('a row is dead-lettered once it exceeds the max attempts on a non-retriable error', async () => {
    jest.resetModules();
    jest.doMock('../../src/services/zoho/zohoService', () => ({
      forOrganization: () => ({
        callCustomFunction: jest.fn().mockRejectedValue(Object.assign(new Error('bad request'), { retriable: false, code: 'BAD_GATEWAY' })),
      }),
    }));
    const { createFakePrisma } = require('../fakePrisma');
    const freshPrisma = createFakePrisma();
    jest.doMock('../../src/config/prisma', () => ({ prisma: freshPrisma }));
    const freshSyncLogRepository = require('../../src/models/syncLogRepository');
    const retryWorker = require('../../src/services/sync/retryWorker');
    const { env } = require('../../src/config/env');

    const org = await freshPrisma.organization.create({ data: { organizationName: 'X', organizationCode: 'X-3', status: 'ACTIVE' } });
    const emp = await freshPrisma.employee.create({ data: { organizationId: org.id, employeeCode: 'EMP-1', fullName: 'A', status: 'ACTIVE' } });
    const dev = await freshPrisma.device.create({ data: { organizationId: org.id, employeeId: emp.id, deviceCode: 'DEV-1', status: 'ONLINE' } });
    const { row } = await freshSyncLogRepository.upsertPending(org.id, {
      deviceId: dev.id, eventType: 'mouse_metrics', eventId: 'e3', zohoEndpoint: 'mouse_metrics', payload: {},
    });

    // Force nextRetryAt into the past before each tick so claimDue picks
    // it back up immediately instead of waiting out real backoff delays.
    for (let i = 0; i < env.SYNC_MAX_ATTEMPTS; i++) {
      const current = freshPrisma.__store.db.activitySyncLog.find((r) => r.id === row.id);
      current.nextRetryAt = new Date(Date.now() - 1000);
      current.status = 'FAILED';
      await retryWorker.runOnce();
    }

    const updated = freshPrisma.__store.db.activitySyncLog.find((r) => r.id === row.id);
    expect(updated.status).toBe('DEAD');
    expect(updated.attempts).toBeGreaterThanOrEqual(env.SYNC_MAX_ATTEMPTS);

    jest.dontMock('../../src/services/zoho/zohoService');
    jest.dontMock('../../src/config/prisma');
  });
});
