const syncLogRepository = require('../../models/syncLogRepository');
const { writeEvent } = require('../zoho/creatorWriter');
const { env } = require('../../config/env');
const { logger } = require('../../config/logger');

/**
 * Full-jitter exponential backoff: attempt N waits a random amount up to
 * base * 2^N, capped. Spreads retries out instead of every failed row
 * hammering Zoho again at the same instant.
 */
function backoffMs(attempts) {
  const exp = Math.min(env.SYNC_MAX_BACKOFF_MS, env.SYNC_BASE_BACKOFF_MS * 2 ** attempts);
  return Math.floor(Math.random() * exp);
}

/**
 * Ships every currently-due row once.
 *
 * CHANGED 06-Sep-2026: delivery goes through creatorWriter.writeEvent
 * (resolve lookups -> upsert by natural key -> upload files) rather than
 * zohoService.callCustomFunction. Two reasons:
 *
 *  1. The custom-function path was writing parameter names that do not
 *     exist on the Creator forms, so fields silently never populated -
 *     device_name and operating_system are blank on the live device
 *     registry record for exactly this reason.
 *  2. It required every new customer to hand-publish eight Deluge custom
 *     APIs before their org could sync at all, which is not viable for a
 *     Marketplace install. Form writes need only the OAuth scopes the
 *     Bridge already requests.
 */
async function runOnce() {
  const rows = await syncLogRepository.claimDue(env.SYNC_WORKER_BATCH_SIZE);
  let rateLimited = false;
  let succeeded = 0;

  for (const row of rows) {
    if (rateLimited) {
      // Hand the row back rather than leaving it stuck IN_FLIGHT.
      await syncLogRepository.markFailed(row.id, {
        attempts: row.attempts,
        lastError: 'deferred: Zoho rate limit active',
        nextRetryAt: new Date(Date.now() + env.SYNC_MAX_BACKOFF_MS),
        dead: false,
      });
      continue;
    }

    try {
      const { recordId, action } = await writeEvent(row.organizationId, row.payload);
      await syncLogRepository.markSuccess(row.id, recordId);
      succeeded += 1;
      logger.debug(
        { syncLogId: row.id, organizationId: row.organizationId, form: row.zohoEndpoint, recordId, action },
        'sync delivered'
      );
    } catch (err) {
      const attempts = row.attempts + 1;
      const isRateLimit = err.code === 'ZOHO_RATE_LIMITED';
      if (isRateLimit) rateLimited = true;

      // A non-retriable error (bad mapping, unresolvable lookup) will never
      // succeed by being tried again, so retire it immediately instead of
      // burning eight attempts and an hour of backoff on it.
      const permanent = err.retriable === false;
      const dead = !isRateLimit && (permanent || attempts >= env.SYNC_MAX_ATTEMPTS);

      await syncLogRepository.markFailed(row.id, {
        attempts,
        lastError: err.message,
        nextRetryAt: new Date(
          Date.now() + (isRateLimit ? env.SYNC_MAX_BACKOFF_MS : backoffMs(attempts))
        ),
        dead,
      });

      logger.warn(
        {
          syncLogId: row.id,
          organizationId: row.organizationId,
          form: row.zohoEndpoint,
          code: err.code,
          attempts,
          dead,
          err: err.message,
        },
        'sync attempt failed'
      );
    }
  }

  return { processed: rows.length, succeeded, rateLimited };
}

let timer = null;

function start() {
  if (timer) return;
  let running = false;
  timer = setInterval(() => {
    // Ticks no longer overlap. claimDue is atomic now, but not re-entering
    // avoids piling up connections when Zoho is slow.
    if (running) return;
    running = true;
    runOnce()
      .catch((err) => logger.error({ err }, 'sync worker tick failed'))
      .finally(() => { running = false; });
  }, env.SYNC_WORKER_INTERVAL_MS);
  logger.info({ intervalMs: env.SYNC_WORKER_INTERVAL_MS }, 'sync retry worker started');
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { start, stop, runOnce };
