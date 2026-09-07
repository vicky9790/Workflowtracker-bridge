const syncLogRepository = require('../../models/syncLogRepository');
const zohoConnectionRepository = require('../../models/zohoConnectionRepository');
const { endpointForEventType, buildParams } = require('../zoho/activityMapper');

/**
 * Records one activity event durably and returns immediately - it never
 * waits on Zoho. That's the whole point: the Agent gets a fast, reliable
 * "recorded" response regardless of whether Zoho happens to be up right
 * now, and delivery to Zoho happens out-of-band via the retry worker.
 *
 * Idempotent on (organizationId, eventId): a duplicate submission of the
 * same event_id (the Agent retrying a batch it wasn't sure was accepted,
 * for example) is recognized and not re-queued.
 *
 * Returns { zohoConnected: false } immediately if the organization has not
 * connected a Zoho Creator account - no row is inserted, no retries are
 * scheduled.  Callers receive a clear status and avoid polluting the
 * sync_log table with rows that would only ever fail.
 */
async function enqueueEvent(organizationId, { device, employee, eventType, eventId, data }) {
  // Guard: skip the queue entirely for orgs without an active Zoho connection.
  // A single indexed lookup is negligible overhead and avoids the full 8-attempt
  // retry cycle that would otherwise fire for every event this org submits.
  const conn = await zohoConnectionRepository.findByOrganization(organizationId);
  if (!conn || conn.status === 'DISCONNECTED') {
    return { syncLogId: null, status: 'zoho_not_connected', duplicate: false, zohoConnected: false };
  }

  const zohoEndpoint = endpointForEventType(eventType);
  const payload = buildParams(eventType, {
    deviceCode: device.deviceCode,
    employeeCode: employee.employeeCode,
    data,
  });

  const { row, created } = await syncLogRepository.upsertPending(organizationId, {
    deviceId: device.id,
    eventType,
    eventId,
    zohoEndpoint,
    payload,
  });

  return { syncLogId: row.id, status: row.status, duplicate: !created, zohoConnected: true };
}

module.exports = { enqueueEvent };
