const { prisma } = require('../config/prisma');

/**
 * Idempotent by (organizationId, eventId). If this exact event was already
 * recorded, returns the existing row instead of creating a duplicate -
 * the caller checks `created` to decide whether to actually queue work.
 */
async function upsertPending(organizationId, { deviceId, eventType, eventId, zohoEndpoint, payload }) {
  const existing = await prisma.activitySyncLog.findUnique({
    where: { organizationId_eventId: { organizationId, eventId } },
  });
  if (existing) {
    return { row: existing, created: false };
  }
  const row = await prisma.activitySyncLog.create({
    data: { organizationId, deviceId, eventType, eventId, zohoEndpoint, payload, status: 'PENDING', attempts: 0 },
  });
  return { row, created: true };
}

/** Rows due for a sync attempt right now, oldest first, capped at `take`. */
function claimDue(take) {
  return prisma.activitySyncLog.findMany({
    where: {
      status: { in: ['PENDING', 'FAILED'] },
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }],
    },
    orderBy: { createdAt: 'asc' },
    take,
  });
}

function markSuccess(id, zohoRecordId) {
  return prisma.activitySyncLog.update({
    where: { id },
    data: { status: 'SUCCESS', lastError: null, nextRetryAt: null, zohoRecordId: zohoRecordId ?? undefined },
  });
}

function markFailed(id, { attempts, lastError, nextRetryAt, dead }) {
  return prisma.activitySyncLog.update({
    where: { id },
    data: {
      status: dead ? 'DEAD' : 'FAILED',
      attempts,
      lastError: String(lastError).slice(0, 2000),
      nextRetryAt: dead ? null : nextRetryAt,
    },
  });
}

function countByStatus(organizationId) {
  return prisma.activitySyncLog.groupBy({
    by: ['status'],
    where: { organizationId },
    _count: { _all: true },
  });
}

function findByEventId(organizationId, eventId) {
  return prisma.activitySyncLog.findUnique({
    where: { organizationId_eventId: { organizationId, eventId } },
  });
}

/** Powers the admin-facing Sync & Activity table - newest first, optional
 *  status filter, paginated. Always scoped by organizationId directly in
 *  the where clause (unlike the update() functions elsewhere, this is a
 *  read, so there's no separate ownership-check step needed). */
function listForOrganization(organizationId, { skip = 0, take = 50, status } = {}) {
  return prisma.activitySyncLog.findMany({
    where: { organizationId, ...(status ? { status } : {}) },
    orderBy: { createdAt: 'desc' },
    skip,
    take,
    include: { device: { include: { employee: true } } },
  });
}

function countForOrganization(organizationId, { status } = {}) {
  return prisma.activitySyncLog.count({ where: { organizationId, ...(status ? { status } : {}) } });
}

module.exports = {
  upsertPending,
  claimDue,
  markSuccess,
  markFailed,
  countByStatus,
  findByEventId,
  listForOrganization,
  countForOrganization,
};
