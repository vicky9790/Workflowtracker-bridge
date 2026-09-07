const { env } = require('../config/env');
const { unauthorized } = require('../utils/errors');
const { asyncHandler } = require('../utils/asyncHandler');

/**
 * Authentication middleware for dedicated Zoho Creator / external system integrations.
 * Verifies X-TrackFlow-Integration-Key header against the configured integration key.
 * Completely separate from admin JWT and device tokens.
 */
const requireIntegrationAuth = asyncHandler(async (req, res, next) => {
  const integrationKey = req.header('X-TrackFlow-Integration-Key');

  if (!integrationKey || !env.TRACKFLOW_INTEGRATION_KEY || integrationKey !== env.TRACKFLOW_INTEGRATION_KEY) {
    throw unauthorized('Invalid or missing integration key');
  }

  next();
});

module.exports = { requireIntegrationAuth };
