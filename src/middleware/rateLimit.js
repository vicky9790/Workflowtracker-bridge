const rateLimit = require('express-rate-limit');
const { env } = require('../config/env');
const { fail } = require('../utils/respond');

function handler(req, res) {
  fail(res, 429, 'RATE_LIMITED', 'Too many requests, please try again later');
}

const general = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

// Tighter limit on unauthenticated endpoints that create resources
// (register, login, enroll) - these are the ones worth protecting from
// brute force / abuse specifically, independent of general API traffic.
const strict = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: Math.max(10, Math.floor(env.RATE_LIMIT_MAX / 10)),
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

module.exports = { general, strict };
