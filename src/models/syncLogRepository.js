const { prisma } = require('../config/prisma');

/**
 * Idempotent by (organizationId, eventId). If this exact event was already
 * recorded, returns the existing row instead of creating a duplicate -
 * the caller checks `created` to decide whether to actually queue work.
 */
async function upsertPending(
  organizationId,
  { deviceId, eventType, eventId, zohoEndpoint, payload, status = 'PENDING', nextRetryAt = null }
) {
  const existing = await prisma.activitySyncLog.findUnique({
    where: { organizationId_eventId: { organizationId, eventId } },
  });
  if (existing) {
    return { row: existing, created: false };
  }
  const row = await prisma.activitySyncLog.create({
    data: {
      organizationId, deviceId, eventType, eventId, zohoEndpoint, payload,
      status, attempts: 0, nextRetryAt,
    },
  });
  return { row, created: true };
}

/**
 * Releases rows parked in WAITING_CONNECTION back into the retry rotation.
 * Called when an organization completes (or repairs) its Zoho OAuth
 * connection, so the backlog accumulated while disconnected flushes on the
 * next worker tick instead of sitting there indefinitely.
 */
async function releaseWaiting(organizationId) {
  const res = await prisma.activitySyncLog.updateMany({
    where: { organizationId, status: 'WAITING_CONNECTION' },
    data: { status: 'PENDING', nextRetryAt: new Date(), lastError: null },
  });
  return { released: res.count };
}

/**
 * Atomically claims rows due for a sync attempt.
 *
 * ------------------------------------------------------------------
 * FIXED 06-Sep-2026 - the function named "claim" did not claim.
 *
 * BEFORE: a plain findMany with no status transition and no lock. Any
 *         second worker process - or simply a tick that ran longer than
 *         SYNC_WORKER_INTERVAL_MS (15 s) and overlapped the next one -
 *         selected the same rows and wrote them to Creator twice. Zoho
 *         would happily create two records, because the duplicate
 *         protection lived in this table rather than in Creator. That
 *         defeats PART 22 at exactly the moment it matters, when Zoho is
 *         slow and ticks start overlapping.
 *
 * AFTER:  rows are moved to IN_FLIGHT inside a transaction before being
 *         returned, so a concurrent claim cannot see them. A row stuck
 *         IN_FLIGHT past the stale window (worker crashed mid-write) is
 *         reclaimed on a later tick.
 * ------------------------------------------------------------------
 */
const IN_FLIGHT_STALE_MS = 5 * 60 * 1000;

async function claimDue(take) {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - IN_FLIGHT_STALE_MS);

  return prisma.$transaction(async (tx) => {
    const candidates = await tx.activitySyncLog.findMany({
      where: {
        OR: [
          {
            status: { in: ['PENDING', 'FAILED'] },
            OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
          },
          // Reclaim rows abandoned by a worker that died mid-flight.
          { status: 'IN_FLIGHT', updatedAt: { lt: staleBefore } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take,
      select: { id: true },
    });

    if (candidates.length === 0) return [];
    const ids = candidates.map((c) => c.id);

    await tx.activitySyncLog.updateMany({
      where: { id: { in: ids } },
      data: { status: 'IN_FLIGHT' },
    });

    return tx.activitySyncLog.findMany({
      where: { id: { in: ids } },
      orderBy: { createdAt: 'asc' },
    });
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
  releaseWaiting,
  claimDue,
  markSuccess,
  markFailed,
  countByStatus,
  findByEventId,
  listForOrganization,
  countForOrganization,
};
