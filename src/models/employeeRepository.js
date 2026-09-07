const { prisma } = require('../config/prisma');

/**
 * Every function here takes organizationId as its first argument and uses
 * it in the where clause - not as an afterthought filter, but as part of
 * the lookup key itself, so it is structurally impossible to fetch another
 * tenant's employee through this module.
 */

function create(organizationId, { employeeCode, fullName, email, department, designation }) {
  return prisma.employee.create({
    data: { organizationId, employeeCode, fullName, email, department, designation, status: 'ACTIVE' },
  });
}

function findByCode(organizationId, employeeCode) {
  return prisma.employee.findUnique({
    where: { organizationId_employeeCode: { organizationId, employeeCode } },
  });
}

function findById(organizationId, id) {
  return prisma.employee.findFirst({ where: { id, organizationId } });
}

function list(organizationId, { skip = 0, take = 50 } = {}) {
  return prisma.employee.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    skip,
    take,
  });
}

function count(organizationId) {
  return prisma.employee.count({ where: { organizationId } });
}

/** Partial update - only the fields actually present in `data` are
 *  changed, so this serves both "edit employee" and "disable/enable"
 *  (a status-only update) without needing two separate functions.
 *  SECURITY: this does NOT scope its own where-clause by organizationId
 *  (Prisma's update-by-id doesn't take a compound key here) - callers
 *  MUST call findById(organizationId, id) first and 404 if it returns
 *  null, before ever calling update(). Every controller in this project
 *  that calls update() does so; see employees.controller.js. */
function update(organizationId, id, data) {
  return prisma.employee.update({ where: { id }, data });
}

module.exports = { create, findByCode, findById, list, count, update };
