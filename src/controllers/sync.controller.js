const { prisma } = require('../config/prisma');
const syncLogRepository = require('../models/syncLogRepository');
const retryWorker = require('../services/sync/retryWorker');
const { ok } = require('../utils/respond');
const { asyncHandler } = require('../utils/asyncHandler');
const { forbidden } = require('../utils/errors');

/**
 * ORG_ADMIN always sees their own organization's counts. SUPER_ADMIN can
 * pass ?organizationId= to inspect any organization; without it, they get
 * their own (which for a SUPER_ADMIN with no organizationId just returns
 * an empty breakdown, not an error - see docs/API.md).
 */
const status = asyncHandler(async (req, res) => {
  const organizationId =
    req.admin.role === 'SUPER_ADMIN' && req.query.organizationId
      ? req.query.organizationId
      : req.admin.organizationId;

  const grouped = organizationId
    ? await syncLogRepository.countByStatus(organizationId)
    : await prisma.activitySyncLog.groupBy({ by: ['status'], _count: { _all: true } });

  const counts = { PENDING: 0, IN_FLIGHT: 0, SUCCESS: 0, FAILED: 0, DEAD: 0 };
  for (const g of grouped) counts[g.status] = g._count._all;

  ok(res, { organizationId: organizationId || null, counts });
});

/** Powers the Sync & Activity table: individual event rows, newest
 *  first, optionally filtered to one status, scoped to organizationId if specified. */
const listLogs = asyncHandler(async (req, res) => {
  const organizationId =
    req.admin.role === 'SUPER_ADMIN' && req.query.organizationId
      ? req.query.organizationId
      : req.admin.organizationId;
  const { skip, take, status: statusFilter } = req.query;

  const where = {
    ...(organizationId ? { organizationId } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  };

  const parsedSkip = Math.max(0, parseInt(skip, 10) || 0);
  const parsedTake = Math.min(100, Math.max(1, parseInt(take, 10) || 50));

  const [items, total] = await Promise.all([
    prisma.activitySyncLog.findMany({
      where,
      skip: parsedSkip,
      take: parsedTake,
      orderBy: { createdAt: 'desc' },
      include: {
        organization: { select: { id: true, organizationName: true, organizationCode: true } },
        device: { include: { employee: true } },
      },
    }),
    prisma.activitySyncLog.count({ where }),
  ]);
  ok(res, { items, total, skip: parsedSkip, take: parsedTake });
});


/**
 * Triggers one retry-worker tick immediately instead of waiting for the
 * interval timer - a "sync now" action. Runs across all organizations'
 * due rows in this MVP (the worker doesn't currently filter by a single
 * organization mid-tick); an ORG_ADMIN may only trigger it for their own
 * organizationId, a SUPER_ADMIN for any.
 */
const triggerSync = asyncHandler(async (req, res) => {
  if (req.admin.role !== 'SUPER_ADMIN' && req.params.organizationId !== req.admin.organizationId) {
    throw forbidden('You can only trigger a sync for your own organization');
  }
  const result = await retryWorker.runOnce();
  ok(res, { triggered: true, ...result });
});

module.exports = { status, listLogs, triggerSync };
