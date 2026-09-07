const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const pinoHttp = require('pino-http');

const { logger } = require('./config/logger');
const { env } = require('./config/env');
const { general: generalRateLimit } = require('./middleware/rateLimit');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { api } = require('./routes');
const healthRoutes = require('./routes/health.routes');

/**
 * CORS.
 *
 * FIXED 06-Sep-2026. This was a bare `cors()` - wildcard origin, on an API
 * whose endpoints issue device tokens and return employee records. Any
 * page on any site could drive it from a logged-in admin's browser. The
 * Agent is an Electron process and sends no Origin header, so it is
 * unaffected by an allowlist; only browser callers are, which is the whole
 * point.
 */
function corsOptions() {
  const allowed = env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
  if (allowed.length === 0) {
    // No browser front-end configured: reject cross-origin outright rather
    // than silently permitting everything.
    return { origin: false, credentials: true };
  }
  return {
    origin(origin, cb) {
      // No Origin header: non-browser client (Agent, curl, server-to-server).
      if (!origin) return cb(null, true);
      return allowed.includes(origin)
        ? cb(null, true)
        : cb(new Error('Origin not allowed'));
    },
    credentials: true,
  };
}

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // The Bridge sits behind a TLS terminator in production; without this
  // express-rate-limit keys every request to the proxy's own IP and
  // req.ip is useless for the audit log.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors(corsOptions()));

  // Screenshots arrive base64-encoded, which inflates the payload by ~33%.
  // The previous 2mb ceiling rejected any real capture with a 413 the
  // Agent recorded as a non-retriable 400, silently discarding it.
  app.use(express.json({ limit: env.JSON_BODY_LIMIT }));

  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/health' },
      // Never let a query string reach the log. Enrollment and OAuth
      // callbacks carry codes in the query, and PART 29 forbids logging
      // activation secrets or OAuth values.
      customProps: (req) => ({ path: String(req.url || '').split('?')[0] }),
      serializers: {
        req(req) {
          return {
            method: req.method,
            path: String(req.url || '').split('?')[0],
            remoteAddress: req.remoteAddress,
          };
        },
      },
    })
  );

  app.use(generalRateLimit);

  app.use('/health', healthRoutes);
  app.use('/api', api);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
