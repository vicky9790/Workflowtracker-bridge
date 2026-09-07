const pino = require('pino');
const { env } = require('./env');

/**
 * Structured JSON logs. Redaction paths cover every place a secret could
 * end up in a log call's metadata object - request headers, request
 * bodies, and any field literally named like a secret. `censor` overwrites
 * rather than removing, so the key stays visible (useful for confirming a
 * secret *was* present) without ever writing its value.
 */
const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.deviceToken',
      '*.device_token',
      '*.accessToken',
      '*.access_token',
      '*.refreshToken',
      '*.refresh_token',
      '*.encryptedRefreshToken',
      '*.clientSecret',
      '*.client_secret',
      '*.jwtSecret',
      '*.encryptionKey',
    ],
    censor: '[REDACTED]',
  },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

module.exports = { logger };
