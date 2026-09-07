const { PrismaClient } = require('@prisma/client');
const { logger } = require('./logger');

/**
 * One Prisma client per process. Prisma already pools connections
 * internally, so a second instance would just mean a second pool for no
 * benefit - this file exists so every other module imports the same one.
 */
const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});

prisma.$on('error', (e) => logger.error({ err: e }, 'prisma error'));
prisma.$on('warn', (e) => logger.warn({ warn: e }, 'prisma warning'));

module.exports = { prisma };
