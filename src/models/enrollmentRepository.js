const { prisma } = require('../config/prisma');

function record(organizationId, { employeeCode, deviceCode }) {
  return prisma.agentEnrollment.create({
    data: { organizationId, employeeCode, deviceCode, status: 'COMPLETED' },
  });
}

module.exports = { record };
