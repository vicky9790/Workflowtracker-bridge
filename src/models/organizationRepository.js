const { prisma } = require('../config/prisma');

function findByCode(organizationCode) {
  return prisma.organization.findUnique({ where: { organizationCode } });
}

function findById(id) {
  return prisma.organization.findUnique({ where: { id } });
}

function create({ organizationName, organizationCode }) {
  return prisma.organization.create({
    data: { organizationName, organizationCode, status: 'ACTIVE' },
  });
}

function updateStatus(id, status) {
  return prisma.organization.update({ where: { id }, data: { status } });
}

function updateName(id, organizationName) {
  return prisma.organization.update({ where: { id }, data: { organizationName } });
}

function getSettings(organizationId) {
  return prisma.organizationSettings.findUnique({
    where: { organizationId }
  });
}

function upsertSettings(organizationId, data) {
  return prisma.organizationSettings.upsert({
    where: { organizationId },
    update: data,
    create: {
      organizationId,
      ...data
    }
  });
}

module.exports = { findByCode, findById, create, updateStatus, updateName, getSettings, upsertSettings };
