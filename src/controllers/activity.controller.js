const syncService = require('../services/sync/syncService');
const { ok } = require('../utils/respond');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest } = require('../utils/errors');

/**
 * Every handler enqueues durably and responds immediately. None wait on Zoho.
 *
 * ------------------------------------------------------------------
 * FIXED 06-Sep-2026 - fabricated success value.
 *
 * BEFORE: responded `{ recorded: true }` unconditionally, including when
 *         syncService had silently discarded the event because the org had
 *         no Zoho connection. The Agent trusted that and deleted the event
 *         from its own queue. Two systems agreed the data was safe while
 *         it existed nowhere.
 *
 * AFTER:  `recorded` reflects what the service actually reports, and the
 *         response carries the real sync state so the Agent (and the
 *         Connection Status page) can distinguish "stored and queued for
 *         Creator" from "stored, waiting for Creator to be connected".
 * ------------------------------------------------------------------
 */
function makeHandler(eventType) {
  return asyncHandler(async (req, res) => {
    const eventId = req.body.event_id;
    if (!eventId) throw badRequest('event_id is required');

    const result = await syncService.enqueueEvent(req.organizationId, {
      device: req.device,
      employee: req.employee,
      eventType,
      eventId,
      data: req.body,
    });

    ok(res, {
      recorded: result.persisted === true,
      duplicate: result.duplicate,
      sync_status: result.status,
      zoho_connected: result.zohoConnected,
      sync_log_id: result.syncLogId,
    }, 202);
  });
}

const workSession = makeHandler('work_session');
const browserActivity = makeHandler('browser_activity');
const applicationUsage = makeHandler('application_usage');
const keyboardMetrics = makeHandler('keyboard_metrics');
const mouseMetrics = makeHandler('mouse_metrics');
const screenshot = makeHandler('screenshot');

/**
 * Accepts { events: [{ type, event_id, data }] }.
 *
 * device_id / employee_id in the body are ignored in favour of the
 * authenticated device's own identity - an Agent cannot claim to report
 * for a device its token does not belong to.
 *
 * A per-event failure no longer aborts the whole batch: each result
 * carries its own outcome so the Agent can retry precisely the events
 * that did not land, instead of resending the entire batch and relying on
 * idempotency to sort it out.
 */
const batch = asyncHandler(async (req, res) => {
  const results = [];
  let accepted = 0;

  for (const evt of req.body.events) {
    if (!evt.event_id) {
      results.push({
        event_id: null, type: evt.type, recorded: false,
        error: 'event_id is required',
      });
      continue;
    }
    try {
      const result = await syncService.enqueueEvent(req.organizationId, {
        device: req.device,
        employee: req.employee,
        eventType: evt.type,
        eventId: evt.event_id,
        data: evt.data,
      });
      accepted += 1;
      results.push({
        event_id: evt.event_id,
        type: evt.type,
        recorded: true,
        duplicate: result.duplicate,
        sync_status: result.status,
      });
    } catch (err) {
      results.push({
        event_id: evt.event_id,
        type: evt.type,
        recorded: false,
        error: err.code || 'INGEST_FAILED',
      });
    }
  }

  ok(res, {
    submitted: req.body.events.length,
    recorded: accepted,
    failed: req.body.events.length - accepted,
    results,
  }, 202);
});

module.exports = {
  workSession,
  browserActivity,
  applicationUsage,
  keyboardMetrics,
  mouseMetrics,
  screenshot,
  batch,
};
