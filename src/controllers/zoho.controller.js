const jwt = require('jsonwebtoken');
const { z } = require('zod');
const zohoConnectionRepository = require('../models/zohoConnectionRepository');
const auditRepository = require('../models/auditRepository');
const syncService = require('../services/sync/syncService');
const { getAuthorizationUrl, exchangeCodeForTokens } = require('../services/zoho/zohoOAuth');
const { encrypt } = require('../utils/crypto');
const { env } = require('../config/env');
const { ok } = require('../utils/respond');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, unauthorized } = require('../utils/errors');

const STATE_TTL = '5m';

const connectQuery = z.object({
  account_owner_name: z.string().min(1),
  app_link_name: z.string().min(1),
  data_center: z.string().min(2).max(10).optional(),
});

/**
 * The state param round-trips account_owner_name/app_link_name/dc through
 * Zoho's redirect as a short-lived signed JWT, rather than server-side
 * session storage - stateless, and Zoho cannot forge or read it since
 * it's opaque to them and signed with our own secret.
 */
const connect = asyncHandler(async (req, res) => {
  const q = connectQuery.parse(req.query);
  const state = jwt.sign(
    {
      type: 'zoho_oauth_state',
      organizationId: req.admin.organizationId,
      accountOwnerName: q.account_owner_name,
      appLinkName: q.app_link_name,
      dataCenter: q.data_center || env.ZOHO_DEFAULT_DC,
    },
    env.JWT_SECRET,
    { expiresIn: STATE_TTL }
  );
  ok(res, { authorization_url: getAuthorizationUrl(state) });
});

const callback = asyncHandler(async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) throw badRequest('Missing code or state');

  let claims;
  try {
    claims = jwt.verify(state, env.JWT_SECRET);
  } catch {
    throw unauthorized('Invalid or expired OAuth state');
  }
  if (claims.type !== 'zoho_oauth_state') throw unauthorized('Invalid OAuth state');

  const { refreshToken } = await exchangeCodeForTokens(code);

  await zohoConnectionRepository.upsert(claims.organizationId, {
    accountOwnerName: claims.accountOwnerName,
    appLinkName: claims.appLinkName,
    dataCenter: claims.dataCenter,
    encryptedRefreshToken: encrypt(refreshToken),
    status: 'CONNECTED',
    connectedAt: new Date(),
    lastError: null,
  });

  // Release everything parked while this organization had no connection.
  // Without this the backlog accumulated during onboarding - which is now
  // retained rather than discarded - would sit in WAITING_CONNECTION
  // forever, because nothing else ever moves a row out of that state.
  const { released } = await syncService.releaseWaiting(claims.organizationId);

  await auditRepository.record({
    organizationId: claims.organizationId,
    actorType: 'ORG_ADMIN',
    action: 'ZOHO_CONNECTED',
    metadata: { appLinkName: claims.appLinkName, backlogReleased: released },
  });

  // A human is sitting in this browser tab, mid-OAuth-consent - a plain
  // success page is more useful here than a JSON blob.
  res.status(200).send('<html><body><h3>Zoho Creator connected. You can close this tab.</h3></body></html>');
});

const status = asyncHandler(async (req, res) => {
  const conn = await zohoConnectionRepository.findByOrganization(req.admin.organizationId);
  if (!conn) {
    return ok(res, { connected: false });
  }
  ok(res, {
    connected: conn.status === 'CONNECTED',
    status: conn.status,
    accountOwnerName: conn.accountOwnerName,
    appLinkName: conn.appLinkName,
    dataCenter: conn.dataCenter,
    connectedAt: conn.connectedAt,
    lastError: conn.lastError,
  });
});

const disconnect = asyncHandler(async (req, res) => {
  await zohoConnectionRepository.disconnect(req.admin.organizationId);
  await auditRepository.record({
    organizationId: req.admin.organizationId,
    actorType: 'ORG_ADMIN',
    actorId: req.admin.id,
    action: 'ZOHO_DISCONNECTED',
  });
  ok(res, { connected: false });
});

module.exports = { connect, callback, status, disconnect };
