const activationService = require('../services/enrollment/activationService');
const organizationRepository = require('../models/organizationRepository');
const { notFound } = require('../utils/errors');
const { ok } = require('../utils/respond');
const { asyncHandler } = require('../utils/asyncHandler');

/**
 * POST /api/integrations/creator/employees/:employeeId/activation
 *
 * Dedicated endpoint for Zoho Creator to issue one-time activation codes for employees.
 * Authenticated via X-TrackFlow-Integration-Key.
 */
const issueCreatorActivation = asyncHandler(async (req, res) => {
  const { employeeId } = req.params;
  const { organizationId, employeeName, email } = req.body;

  // Verify the organization exists (support either UUID id or organizationCode)
  let org = await organizationRepository.findById(organizationId);
  if (!org) {
    org = await organizationRepository.findByCode(organizationId);
  }
  if (!org) {
    throw notFound('Organization not found');
  }

  // activationService.issue verifies the employee belongs to that organization,
  // revokes previous active codes, generates code, hashes it, and returns the result.
  const result = await activationService.issue(org.id, employeeId, {
    createdBy: 'CREATOR_INTEGRATION',
    employeeName,
    email,
  });

  // Plaintext code is returned directly in response and never logged.
  ok(res, result);
});

module.exports = { issueCreatorActivation };
