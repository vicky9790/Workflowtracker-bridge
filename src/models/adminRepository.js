const { prisma } = require('../config/prisma');

function findByEmail(email) {
  return prisma.orgAdmin.findUnique({ where: { email } });
}

function create({ organizationId, email, passwordHash, role = 'ORG_ADMIN' }) {
  return prisma.orgAdmin.create({
    data: { organizationId, email, passwordHash, role },
  });
}

function countSuperAdmins() {
  return prisma.orgAdmin.count({ where: { role: 'SUPER_ADMIN' } });
}

module.exports = { findByEmail, create, countSuperAdmins };
