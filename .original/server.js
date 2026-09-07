const { env, assertRequiredEnv } = require('./config/env');
const { logger } = require('./config/logger');
const { prisma } = require('./config/prisma');
const { createApp } = require('./app');
const retryWorker = require('./services/sync/retryWorker');

async function main() {
  assertRequiredEnv();

  await prisma.$connect();
  logger.info('database connected');

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'bridge-backend listening');
  });

  retryWorker.start();

  async function shutdown(signal) {
    logger.info({ signal }, 'shutting down');
    retryWorker.stop();
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
    // Force-exit if connections don't close promptly.
    setTimeout(() => process.exit(1), 10_000).unref();
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[FATAL] failed to start', err);
  process.exit(1);
});
