const { prisma } = require('../config/prisma');

function findByOrganization(organizationId) {
  return prisma.zohoConnection.findUnique({ where: { organizationId } });
}

function upsert(organizationId, data) {
  return prisma.zohoConnection.upsert({
    where: { organizationId },
    create: { organizationId, ...data },
    update: data,
  });
}

function markError(organizationId, message) {
  return prisma.zohoConnection.update({
    where: { organizationId },
    data: { status: 'ERROR', lastError: message },
  });
}

function disconnect(organizationId) {
  return prisma.zohoConnection.update({
    where: { organizationId },
    data: {
      status: 'DISCONNECTED',
      encryptedRefreshToken: '',
      lastError: null,
    },
  });
}

function update(organizationId, data) {
  return prisma.zohoConnection.update({
    where: { organizationId },
    data,
  });
}

module.exports = { findByOrganization, upsert, update, markError, disconnect };
