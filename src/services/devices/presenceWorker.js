const { prisma } = require('../../config/prisma');
const { env } = require('../../config/env');
const { logger } = require('../../config/logger');
const syncService = require('../sync/syncService');

/**
 * Marks devices offline when their heartbeat stops (PART 13).
 *
 * ADDED 06-Sep-2026. Nothing anywhere in the Bridge ever transitioned a
 * device out of ONLINE. The live Creator device registry currently shows
 * DEV-C243585B65D2BA807350 as "ONLINE" with a last heartbeat of
 * 02-Sep 22:44 - four days stale. Every "Online Devices" KPI built on that
 * field has been reporting a number that cannot go down.
 *
 * The threshold is derived from the heartbeat interval rather than
 * hard-coded, so it stays correct if the interval is retuned: a device is
 * offline once it misses three consecutive heartbeats.
 */
function offlineThresholdMs() {
  return env.DEVICE_OFFLINE_AFTER_MS
    || (env.DEFAULT_HEARTBEAT_INTERVAL_MS * env.DEVICE_OFFLINE_MISSED_BEATS);
}

async function runOnce() {
  const cutoff = new Date(Date.now() - offlineThresholdMs());

  const stale = await prisma.device.findMany({
    where: {
      status: 'ONLINE',
      OR: [{ lastSeen: { lt: cutoff } }, { lastSeen: null }],
    },
    include: { employee: true },
  });

  if (stale.length === 0) return { markedOffline: 0 };

  await prisma.device.updateMany({
    where: { id: { in: stale.map((d) => d.id) } },
    data: { status: 'OFFLINE' },
  });

  // Push the real state to each organization's Creator device registry so
  // the dashboard stops showing a device that has been gone for days as
  // online. Queued, so a Zoho outage cannot lose the transition.
  for (const device of stale) {
    try {
      await syncService.enqueueEvent(device.organizationId, {
        device,
        employee: device.employee,
        eventType: 'device_register',
        eventId: `device_offline:${device.id}:${cutoff.toISOString().slice(0, 13)}`,
        data: {
          device_status: 'OFFLINE',
          last_heartbeat: device.lastSeen?.toISOString(),
          last_active_time: device.lastSeen?.toISOString(),
          agent_version: device.agentVersion,
          hostname: device.hostname,
          os: device.os,
          os_version: device.osVersion,
        },
      });
    } catch (err) {
      logger.warn(
        { deviceId: device.id, err: err.message },
        'failed to queue offline transition to Creator'
      );
    }
  }

  logger.info({ count: stale.length, cutoff }, 'devices marked offline');
  return { markedOffline: stale.length };
}

let timer = null;

function start() {
  if (timer) return;
  let running = false;
  timer = setInterval(() => {
    if (running) return;
    running = true;
    runOnce()
      .catch((err) => logger.error({ err }, 'presence worker tick failed'))
      .finally(() => { running = false; });
  }, env.DEVICE_PRESENCE_INTERVAL_MS);
  logger.info({ intervalMs: env.DEVICE_PRESENCE_INTERVAL_MS }, 'device presence worker started');
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { start, stop, runOnce };
