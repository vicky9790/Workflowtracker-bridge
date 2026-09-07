const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const pinoHttp = require('pino-http');

const { logger } = require('./config/logger');
const { general: generalRateLimit } = require('./middleware/rateLimit');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { api } = require('./routes');
const healthRoutes = require('./routes/health.routes');

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  // No fixed origin allowlist yet - there is no admin dashboard frontend
  // built alongside this Bridge yet to lock it to. Restrict this to that
  // origin once it exists; see docs/DEPLOYMENT.md.
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/health' },
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
