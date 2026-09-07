const { prisma } = require('../config/prisma');
const { ok } = require('../utils/respond');
const { asyncHandler } = require('../utils/asyncHandler');
const { notFound } = require('../utils/errors');
const auditRepository = require('../models/auditRepository');

/**
 * GET /api/platform/overview
 * Platform-wide overview KPIs for SUPER_ADMIN console.
 */
const getOverview = asyncHandler(async (req, res) => {
  const [
    totalOrgs,
    activeOrgs,
    totalEmployees,
    activeEmployees,
    totalDevices,
    onlineDevices,
    totalZoho,
    connectedZoho,
  ] = await Promise.all([
    prisma.organization.count(),
    prisma.organization.count({ where: { status: 'ACTIVE' } }),
    prisma.employee.count(),
    prisma.employee.count({ where: { status: 'ACTIVE' } }),
    prisma.device.count(),
    prisma.device.count({ where: { status: 'ONLINE' } }),
    prisma.zohoConnection.count(),
    prisma.zohoConnection.count({ where: { status: 'CONNECTED' } }),
  ]);

  ok(res, {
    organizations: { total: totalOrgs, active: activeOrgs },
    employees: { total: totalEmployees, active: activeEmployees },
    devices: { total: totalDevices, online: onlineDevices },
    zohoConnections: { total: totalZoho, connected: connectedZoho },
  });
});

/**
 * GET /api/platform/organizations
 * Paginated list of organizations with related summary counts.
 */
const listOrganizations = asyncHandler(async (req, res) => {
  const skip = Math.max(0, parseInt(req.query.skip, 10) || 0);
  const take = Math.min(100, Math.max(1, parseInt(req.query.take, 10) || 50));
  const { status, search } = req.query;

  const where = {};
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { organizationName: { contains: search, mode: 'insensitive' } },
      { organizationCode: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        admins: { select: { email: true, role: true } },
        zohoConnection: { select: { status: true, accountOwnerName: true, appLinkName: true, dataCenter: true, connectedAt: true } },
        settings: true,
      },
    }),
    prisma.organization.count({ where }),
  ]);

  // Augment items with employee and device counts
  const enriched = await Promise.all(
    items.map(async (org) => {
      const [employeeCount, deviceCount, onlineDeviceCount] = await Promise.all([
        prisma.employee.count({ where: { organizationId: org.id } }),
        prisma.device.count({ where: { organizationId: org.id } }),
        prisma.device.count({ where: { organizationId: org.id, status: 'ONLINE' } }),
      ]);
      return {
        ...org,
        stats: {
          employees: employeeCount,
          devices: deviceCount,
          onlineDevices: onlineDeviceCount,
        },
      };
    })
  );

  ok(res, { items: enriched, total, skip, take });
});

/**
 * GET /api/platform/organizations/:id
 * Full details of a single organization for platform admins.
 */
const getOrganizationById = asyncHandler(async (req, res) => {
  const org = await prisma.organization.findUnique({
    where: { id: req.params.id },
    include: {
      admins: { select: { id: true, email: true, role: true, createdAt: true } },
      zohoConnection: {
        select: {
          id: true,
          status: true,
          accountOwnerName: true,
          appLinkName: true,
          dataCenter: true,
          timeZone: true,
          connectedAt: true,
          lastError: true,
        },
      },
      settings: true,
    },
  });

  if (!org) throw notFound('Organization not found');

  const [employeeCount, deviceCount, onlineDeviceCount] = await Promise.all([
    prisma.employee.count({ where: { organizationId: org.id } }),
    prisma.device.count({ where: { organizationId: org.id } }),
    prisma.device.count({ where: { organizationId: org.id, status: 'ONLINE' } }),
  ]);

  ok(res, {
    ...org,
    stats: {
      employees: employeeCount,
      devices: deviceCount,
      onlineDevices: onlineDeviceCount,
    },
  });
});

/**
 * PATCH /api/platform/organizations/:id/status
 * Update organization status (ACTIVE, SUSPENDED, DISABLED).
 */
const updateOrganizationStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['ACTIVE', 'SUSPENDED', 'DISABLED'].includes(status)) {
    return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid status' } });
  }

  const updated = await prisma.organization.update({
    where: { id: req.params.id },
    data: { status },
  });

  await auditRepository.record({
    organizationId: updated.id,
    actorType: req.admin.role,
    actorId: req.admin.id,
    action: 'ORGANIZATION_STATUS_UPDATED',
    metadata: { status },
  });

  ok(res, updated);
});

/**
 * GET /api/platform/employees
 * Platform-wide employees list with search and filtering.
 */
const listEmployees = asyncHandler(async (req, res) => {
  const skip = Math.max(0, parseInt(req.query.skip, 10) || 0);
  const take = Math.min(100, Math.max(1, parseInt(req.query.take, 10) || 50));
  const { organizationId, status, search } = req.query;

  const where = {};
  if (organizationId) where.organizationId = organizationId;
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { employeeCode: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        organization: { select: { id: true, organizationName: true, organizationCode: true } },
        devices: { select: { id: true, deviceCode: true, status: true, lastSeen: true } },
      },
    }),
    prisma.employee.count({ where }),
  ]);

  ok(res, { items, total, skip, take });
});

/**
 * GET /api/platform/devices
 * Platform-wide devices list with status, search, and filtering.
 */
const listDevices = asyncHandler(async (req, res) => {
  const skip = Math.max(0, parseInt(req.query.skip, 10) || 0);
  const take = Math.min(100, Math.max(1, parseInt(req.query.take, 10) || 50));
  const { organizationId, status, search } = req.query;

  const where = {};
  if (organizationId) where.organizationId = organizationId;
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { deviceCode: { contains: search, mode: 'insensitive' } },
      { hostname: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.device.findMany({
      where,
      skip,
      take,
      orderBy: { lastSeen: 'desc' },
      include: {
        organization: { select: { id: true, organizationName: true, organizationCode: true } },
        employee: { select: { id: true, employeeCode: true, fullName: true } },
      },
    }),
    prisma.device.count({ where }),
  ]);

  ok(res, { items, total, skip, take });
});

/**
 * GET /api/platform/zoho-connections
 * Platform-wide Zoho Creator connections directory.
 */
const listZohoConnections = asyncHandler(async (req, res) => {
  const items = await prisma.zohoConnection.findMany({
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      organizationId: true,
      accountOwnerName: true,
      appLinkName: true,
      dataCenter: true,
      timeZone: true,
      status: true,
      connectedAt: true,
      lastError: true,
      createdAt: true,
      updatedAt: true,
      organization: { select: { id: true, organizationName: true, organizationCode: true } },
    },
  });

  ok(res, { items, total: items.length });
});

/**
 * GET /api/platform/audit-logs
 * Platform-wide audit logs query.
 */
const listAuditLogs = asyncHandler(async (req, res) => {
  const skip = Math.max(0, parseInt(req.query.skip, 10) || 0);
  const take = Math.min(100, Math.max(1, parseInt(req.query.take, 10) || 50));
  const { organizationId, action } = req.query;

  const where = {};
  if (organizationId) where.organizationId = organizationId;
  if (action) where.action = action;

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        organization: { select: { id: true, organizationName: true, organizationCode: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  ok(res, { items, total, skip, take });
});

/**
 * PATCH /api/platform/devices/:id/status
 * Platform admin toggle device status.
 */
const updateDeviceStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const existing = await prisma.device.findUnique({ where: { id } });
  if (!existing) throw notFound('Device not found');

  const updated = await prisma.device.update({
    where: { id },
    data: { status },
  });

  await auditRepository.record({
    organizationId: existing.organizationId,
    actorType: req.admin.role,
    actorId: req.admin.id,
    action: status === 'DISABLED' ? 'DEVICE_DISABLED' : 'DEVICE_STATUS_CHANGED',
    metadata: { deviceCode: existing.deviceCode, status },
  });

  ok(res, updated);
});

/**
 * POST /api/platform/devices/:id/revoke-token
 * Platform admin revoke active tokens for device.
 */
const revokeDeviceToken = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existing = await prisma.device.findUnique({ where: { id } });
  if (!existing) throw notFound('Device not found');

  const result = await prisma.deviceToken.updateMany({
    where: { deviceId: id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await auditRepository.record({
    organizationId: existing.organizationId,
    actorType: req.admin.role,
    actorId: req.admin.id,
    action: 'DEVICE_TOKEN_REVOKED',
    metadata: { deviceCode: existing.deviceCode, tokensRevoked: result.count },
  });

  ok(res, { revoked: result.count });
});

module.exports = {
  getOverview,
  listOrganizations,
  getOrganizationById,
  updateOrganizationStatus,
  listEmployees,
  listDevices,
  updateDeviceStatus,
  revokeDeviceToken,
  listZohoConnections,
  listAuditLogs,
};

