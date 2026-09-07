const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const { unauthorized } = require('../utils/errors');
const { asyncHandler } = require('../utils/asyncHandler');

/**
 * Verifies the Authorization: Bearer <jwt> header issued by
 * POST /api/organizations/login. Attaches req.admin = { id, role,
 * organizationId, email }. Stateless on purpose (no DB round trip per
 * request) - tokens are short-lived (see auth.service.js) rather than
 * individually revocable before expiry, a deliberate MVP tradeoff noted
 * in docs/API.md.
 */
const requireAdminAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw unauthorized('Missing or malformed Authorization header');
  }

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw unauthorized('Invalid or expired token');
  }

  if (payload.type !== 'admin') {
    throw unauthorized('Invalid token type');
  }

  req.admin = {
    id: payload.sub,
    role: payload.role,
    organizationId: payload.organizationId,
    email: payload.email,
  };
  next();
});

module.exports = { requireAdminAuth };
