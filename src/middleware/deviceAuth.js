const { prisma } = require('../config/prisma');
const { sha256 } = require('../utils/crypto');
const { unauthorized, forbidden } = require('../utils/errors');
const { asyncHandler } = require('../utils/asyncHandler');

/**
 * Verifies the Authorization: Bearer <device_token> header the Agent sends
 * on every call after enrollment. Attaches req.device, req.organizationId,
 * req.employeeId. This is the single choke point tenant isolation for
 * Agent traffic runs through: every downstream handler gets the
 * organizationId from here, never from the request body, so a device from
 * one organization can never claim to be acting for another.
 */
const requireDeviceAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw unauthorized('Missing or malformed Authorization header');
  }

  const tokenHash = sha256(token);
  const deviceToken = await prisma.deviceToken.findUnique({
    where: { tokenHash },
    include: { device: { include: { employee: true } } },
  });

  if (!deviceToken || deviceToken.revokedAt) {
    throw unauthorized('Invalid or revoked device token');
  }
  if (deviceToken.expiresAt && deviceToken.expiresAt.getTime() < Date.now()) {
    throw unauthorized('Device token has expired');
  }

  const device = deviceToken.device;
  if (!device || device.organizationId !== deviceToken.organizationId) {
    // Defense in depth: should be structurally impossible given the FK,
    // but never trust a cross-tenant request on a technicality.
    throw unauthorized('Invalid device token');
  }
  if (device.status === 'DISABLED') {
    throw forbidden('Device is disabled');
  }

  // Fire-and-forget - a slow write here shouldn't hold up the request,
  // and losing an occasional lastUsedAt update is harmless.
  prisma.deviceToken
    .update({ where: { id: deviceToken.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  req.device = device;
  req.employee = device.employee;
  req.organizationId = device.organizationId;
  req.employeeId = device.employeeId;
  next();
});

module.exports = { requireDeviceAuth };
