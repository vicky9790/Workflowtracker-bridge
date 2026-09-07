const authService = require('../services/auth/authService');
const organizationRepository = require('../models/organizationRepository');
const auditRepository = require('../models/auditRepository');
const { ok } = require('../utils/respond');
const { asyncHandler } = require('../utils/asyncHandler');
const { notFound } = require('../utils/errors');

const register = asyncHandler(async (req, res) => {
  const { organizationName, email, password } = req.body;
  const { organization, admin, token } = await authService.registerOrganization({
    organizationName,
    email,
    password,
  });
  ok(
    res,
    {
      organization: {
        id: organization.id,
        organizationName: organization.organizationName,
        organizationCode: organization.organizationCode,
        status: organization.status,
      },
      admin: { id: admin.id, email: admin.email, role: admin.role },
      token,
    },
    201
  );
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const { admin, token } = await authService.login({ email, password });
  ok(res, {
    admin: { id: admin.id, email: admin.email, role: admin.role, organizationId: admin.organizationId },
    token,
  });
});

const getCurrent = asyncHandler(async (req, res) => {
  const org = await organizationRepository.findById(req.admin.organizationId);
  if (!org) throw notFound('Organization not found');
  ok(res, org);
});

const update = asyncHandler(async (req, res) => {
  const updated = await organizationRepository.updateName(req.admin.organizationId, req.body.organizationName);
  await auditRepository.record({
    organizationId: req.admin.organizationId,
    actorType: req.admin.role,
    actorId: req.admin.id,
    action: 'ORGANIZATION_UPDATED',
    metadata: { organizationName: req.body.organizationName },
  });
  ok(res, updated);
});

const getSettings = asyncHandler(async (req, res) => {
  const settings = await organizationRepository.getSettings(req.admin.organizationId);
  if (!settings) throw notFound('Organization settings not found');
  ok(res, settings);
});

const updateSettings = asyncHandler(async (req, res) => {
  const orgId = req.admin.organizationId;
  const { setupCompleted, organizationName, ...settingsData } = req.body;

  if (organizationName) {
    await organizationRepository.updateName(orgId, organizationName);
  }

  if (setupCompleted === true) {
    settingsData.setupCompletedAt = new Date();
    settingsData.onboardingCompleted = true;
  } else if (setupCompleted === false) {
    settingsData.setupCompletedAt = null;
    settingsData.onboardingCompleted = false;
  }

  const updatedSettings = await organizationRepository.upsertSettings(orgId, settingsData);

  await auditRepository.record({
    organizationId: orgId,
    actorType: req.admin.role,
    actorId: req.admin.id,
    action: 'ORGANIZATION_SETTINGS_UPDATED',
    metadata: {
      organizationName,
      timeZone: settingsData.timeZone,
      setupCompleted
    }
  });

  const currentOrg = await organizationRepository.findById(orgId);

  ok(res, {
    ...updatedSettings,
    organizationName: currentOrg.organizationName,
    setupCompleted
  });
});

module.exports = { register, login, getCurrent, update, getSettings, updateSettings };
