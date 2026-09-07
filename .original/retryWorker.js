const syncLogRepository = require('../../models/syncLogRepository');
const { forOrganization } = require('../zoho/zohoService');
const { env } = require('../../config/env');
const { logger } = require('../../config/logger');

/**
 * Full jitter exponential backoff: attempt N waits a random amount up to
 * base * 2^N, capped. Spreads retries out instead of every failed row
 * hammering Zoho again at exactly the same moment.
 */
function backoffMs(attempts) {
  const exp = Math.min(env.SYNC_MAX_BACKOFF_MS, env.SYNC_BASE_BACKOFF_MS * 2 ** attempts);
  return Math.floor(Math.random() * exp);
}

/** Ships every currently-due row once. Exported directly so tests (and a
 *  manual "sync now" admin action) can trigger a tick without waiting for
 *  the interval timer. */
async function runOnce() {
  const rows = await syncLogRepository.claimDue(env.SYNC_WORKER_BATCH_SIZE);
  let rateLimited = false;

  for (const row of rows) {
    if (rateLimited) break; // don't keep hammering Zoho once it's told us to back off

    const zoho = forOrganization(row.organizationId);
    try {
      const result = await zoho.callCustomFunction(row.zohoEndpoint, row.payload);
      const parsed = typeof result?.result === 'string' ? safeJson(result.result) : result;
      const zohoRecordId = parsed?.record_id ?? null;

      if (parsed && parsed.success === false) {
        // Zoho accepted the HTTP call but the Deluge function itself
        // reported a logic failure (e.g. employee not found) - this
        // will not resolve itself by retrying, so don't keep trying it
        // forever, but do keep the row (status FAILED, not DEAD) so
        // it's visible for an admin to investigate rather than silently
        // vanishing.
        await syncLogRepository.markFailed(row.id, {
          attempts: row.attempts + 1,
          lastError: parsed.message || 'Zoho function reported failure',
          nextRetryAt: new Date(Date.now() + backoffMs(row.attempts + 1)),
          dead: row.attempts + 1 >= env.SYNC_MAX_ATTEMPTS,
        });
        continue;
      }

      await syncLogRepository.markSuccess(row.id, zohoRecordId);
    } catch (err) {
      const attempts = row.attempts + 1;
      const isRateLimit = err.code === 'ZOHO_RATE_LIMITED';
      if (isRateLimit) rateLimited = true;

      const dead = !isRateLimit && attempts >= env.SYNC_MAX_ATTEMPTS && err.retriable !== true;
      await syncLogRepository.markFailed(row.id, {
        attempts,
        lastError: err.message,
        nextRetryAt: new Date(Date.now() + (isRateLimit ? env.SYNC_MAX_BACKOFF_MS : backoffMs(attempts))),
        dead,
      });
      logger.warn(
        { syncLogId: row.id, organizationId: row.organizationId, endpoint: row.zohoEndpoint, attempts, dead, err: err.message },
        'sync attempt failed'
      );
    }
  }

  return { processed: rows.length, rateLimited };
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

let timer = null;

function start() {
  if (timer) return;
  timer = setInterval(() => {
    runOnce().catch((err) => logger.error({ err }, 'sync worker tick failed'));
  }, env.SYNC_WORKER_INTERVAL_MS);
  logger.info({ intervalMs: env.SYNC_WORKER_INTERVAL_MS }, 'sync retry worker started');
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { start, stop, runOnce };
