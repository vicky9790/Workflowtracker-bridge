const { prisma } = require('../config/prisma');

function findByCode(organizationId, deviceCode) {
  return prisma.device.findUnique({
    where: { organizationId_deviceCode: { organizationId, deviceCode } },
  });
}

function findById(organizationId, id) {
  return prisma.device.findFirst({ where: { id, organizationId } });
}

function list(organizationId, { skip = 0, take = 50 } = {}) {
  return prisma.device.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    skip,
    take,
    include: { employee: true },
  });
}

function count(organizationId) {
  return prisma.device.count({ where: { organizationId } });
}

function create(organizationId, { employeeId, deviceCode, hostname, os, osVersion, arch, agentVersion }) {
  return prisma.device.create({
    data: {
      organizationId,
      employeeId,
      deviceCode,
      hostname,
      os,
      osVersion,
      arch,
      agentVersion,
      status: 'ONLINE',
      lastSeen: new Date(),
    },
  });
}

function touchHeartbeat(organizationId, id, { agentVersion } = {}) {
  return prisma.device.update({
    where: { id },
    data: {
      lastSeen: new Date(),
      status: 'ONLINE',
      ...(agentVersion ? { agentVersion } : {}),
    },
  });
}

/** SECURITY: does not itself scope by organizationId - callers must
 *  findById(organizationId, id) first and 404 on null. See the matching
 *  note on employeeRepository.update() for why. */
function setStatus(organizationId, id, status) {
  return prisma.device.update({ where: { id }, data: { status } });
}

function createToken(organizationId, deviceId, tokenHash, expiresAt) {
  return prisma.deviceToken.create({
    data: { organizationId, deviceId, tokenHash, expiresAt, issuedAt: new Date() },
  });
}

function revokeTokensForDevice(organizationId, deviceId) {
  return prisma.deviceToken.updateMany({
    where: { organizationId, deviceId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

module.exports = {
  findByCode,
  findById,
  list,
  count,
  create,
  touchHeartbeat,
  setStatus,
  createToken,
  revokeTokensForDevice,
};
