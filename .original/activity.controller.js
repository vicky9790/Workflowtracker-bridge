const syncService = require('../services/sync/syncService');
const { ok } = require('../utils/respond');
const { asyncHandler } = require('../utils/asyncHandler');

/**
 * Every handler below does the same three things: build the event_id
 * (already supplied by the Agent for these types, since browser OPEN/CLOSE
 * and session events need a stable id the Agent itself controls),
 * enqueue it durably, and respond immediately. None of them wait on Zoho.
 */
function makeHandler(eventType, eventIdOf) {
  return asyncHandler(async (req, res) => {
    const result = await syncService.enqueueEvent(req.organizationId, {
      device: req.device,
      employee: req.employee,
      eventType,
      eventId: eventIdOf(req.body),
      data: req.body,
    });
    ok(res, { recorded: true, duplicate: result.duplicate, sync_log_id: result.syncLogId }, 202);
  });
}

const workSession = makeHandler('work_session', (b) => b.event_id);
const browserActivity = makeHandler('browser_activity', (b) => b.event_id);
const applicationUsage = makeHandler('application_usage', (b) => b.event_id);
const keyboardMetrics = makeHandler('keyboard_metrics', (b) => b.event_id);
const mouseMetrics = makeHandler('mouse_metrics', (b) => b.event_id);
const screenshot = makeHandler('screenshot', (b) => b.event_id);



/**
 * Accepts the { device_id, employee_id, events: [{type, data}] } shape
 * described in the spec. device_id/employee_id in the body are ignored in
 * favor of the authenticated device's own identity - the Agent cannot
 * claim to be reporting for a different device than the one its token
 * belongs to.
 */
const batch = asyncHandler(async (req, res) => {
  const results = [];
  for (const evt of req.body.events) {
    const eventType = evt.type;
    const result = await syncService.enqueueEvent(req.organizationId, {
      device: req.device,
      employee: req.employee,
      eventType,
      eventId: evt.event_id,
      data: evt.data,
    });
    results.push({ event_id: evt.event_id, type: evt.type, duplicate: result.duplicate });
  }
  ok(res, { recorded: results.length, results }, 202);
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
