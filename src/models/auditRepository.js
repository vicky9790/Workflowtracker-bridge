const { prisma } = require('../config/prisma');

function record({ organizationId = null, actorType, actorId = null, action, metadata }) {
  // Audit logging must never break the request it's describing.
  return prisma.auditLog
    .create({ data: { organizationId, actorType, actorId, action, metadata } })
    .catch(() => {});
}

module.exports = { record };
