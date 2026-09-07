const syncLogRepository = require('../../models/syncLogRepository');
const zohoConnectionRepository = require('../../models/zohoConnectionRepository');
const { mapEvent, endpointForEventType } = require('../zoho/activityMapper');

/**
 * Records one activity event durably and returns immediately - it never
 * waits on Zoho. The Agent gets a fast, reliable response regardless of
 * whether Creator happens to be reachable, and delivery happens
 * out-of-band via the retry worker.
 *
 * Idempotent on (organizationId, eventId).
 *
 * ------------------------------------------------------------------
 * FIXED 06-Sep-2026 - silent data loss.
 *
 * BEFORE: if the organization had no Zoho connection this returned
 *         `{ status: 'zoho_not_connected' }` WITHOUT inserting a row. The
 *         event was gone. The controller then answered the Agent with
 *         `recorded: true`, so the Agent dropped it from its local SQLite
 *         queue as well. Every event submitted before an admin finished
 *         the OAuth connect - which is the whole onboarding window - was
 *         destroyed by design, and PART 21 / TEST 38-41 could never pass.
 *
 * AFTER:  the row is always written. With no connection it is parked in
 *         WAITING_CONNECTION with no retry scheduled, so it costs nothing
 *         and pollutes no backoff cycle. Connecting Zoho releases the
 *         parked rows (releaseWaiting below), which is what makes
 *         "disconnect Zoho, keep working, reconnect, data arrives" behave
 *         the way the spec requires.
 * ------------------------------------------------------------------
 */
async function enqueueEvent(
  organizationId,
  { device, employee, eventType, eventId, data, timeZone }
) {
  if (!eventId) {
    const err = new Error('event_id is required for idempotent ingestion');
    err.code = 'MISSING_EVENT_ID';
    err.status = 400;
    throw err;
  }

  const conn = await zohoConnectionRepository.findByOrganization(organizationId);
  const zohoConnected = Boolean(conn && conn.status !== 'DISCONNECTED');

  const spec = mapEvent(eventType, {
    deviceCode: device.deviceCode,
    employeeCode: employee.employeeCode,
    data,
    timeZone: timeZone || conn?.timeZone,
  });

  const { row, created } = await syncLogRepository.upsertPending(organizationId, {
    deviceId: device.id,
    eventType,
    eventId,
    zohoEndpoint: spec.form,
    payload: spec,
    // No connection yet: hold the row out of the retry rotation instead of
    // burning eight attempts against an endpoint that cannot exist.
    nextRetryAt: zohoConnected ? new Date() : null,
    status: zohoConnected ? 'PENDING' : 'WAITING_CONNECTION',
  });

  return {
    syncLogId: row.id,
    status: row.status,
    duplicate: !created,
    zohoConnected,
    persisted: true,
  };
}

/**
 * Called from the Zoho OAuth callback once a connection becomes CONNECTED.
 * Moves every parked row back into the retry rotation so the backlog
 * accumulated during onboarding (or an outage) flushes on the next worker
 * tick instead of sitting there forever.
 */
async function releaseWaiting(organizationId) {
  return syncLogRepository.releaseWaiting(organizationId);
}

module.exports = { enqueueEvent, releaseWaiting, endpointForEventType };
