const employeeRepository = require('../models/employeeRepository');
const auditRepository = require('../models/auditRepository');
const { ok } = require('../utils/respond');
const { asyncHandler } = require('../utils/asyncHandler');
const activationService = require('../services/enrollment/activationService');
const { conflict, notFound } = require('../utils/errors');

const create = asyncHandler(async (req, res) => {
  const organizationId = req.admin.organizationId;
  const existing = await employeeRepository.findByCode(organizationId, req.body.employeeCode);
  if (existing) throw conflict('An employee with this employeeCode already exists');

  const employee = await employeeRepository.create(organizationId, req.body);
  await auditRepository.record({
    organizationId,
    actorType: req.admin.role,
    actorId: req.admin.id,
    action: 'EMPLOYEE_CREATED',
    metadata: { employeeCode: employee.employeeCode },
  });
  ok(res, employee, 201);
});

const list = asyncHandler(async (req, res) => {
  const organizationId = req.admin.organizationId;
  const { skip, take } = req.query;
  const [items, total] = await Promise.all([
    employeeRepository.list(organizationId, { skip, take }),
    employeeRepository.count(organizationId),
  ]);
  ok(res, { items, total, skip, take });
});

const getById = asyncHandler(async (req, res) => {
  const employee = await employeeRepository.findById(req.admin.organizationId, req.params.id);
  if (!employee) throw notFound('Employee not found');
  ok(res, employee);
});

const update = asyncHandler(async (req, res) => {
  const organizationId = req.admin.organizationId;
  const existing = await employeeRepository.findById(organizationId, req.params.id);
  if (!existing) throw notFound('Employee not found');

  const updated = await employeeRepository.update(organizationId, req.params.id, req.body);
  await auditRepository.record({
    organizationId,
    actorType: req.admin.role,
    actorId: req.admin.id,
    action: req.body.status ? 'EMPLOYEE_STATUS_CHANGED' : 'EMPLOYEE_UPDATED',
    metadata: { employeeCode: existing.employeeCode, changes: req.body },
  });
  ok(res, updated);
});

/**
 * POST /api/employees/:id/activation
 *
 * ADDED 06-Sep-2026. Completes PART 7/8: the admin creates the employee,
 * then issues a one-time activation code for them. The plaintext code is
 * in this response and nowhere else - it is not stored, not logged, and
 * cannot be retrieved again. Re-issuing revokes the previous code.
 */
const issueActivation = asyncHandler(async (req, res) => {
  const result = await activationService.issue(
    req.admin.organizationId,
    req.params.id,
    { createdBy: req.admin.id }
  );
  ok(res, result, 201);
});

module.exports = {
  issueActivation, create, list, getById, update };
