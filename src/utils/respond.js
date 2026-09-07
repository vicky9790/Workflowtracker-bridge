/**
 * Every response from this API uses one of these two shapes:
 *   { success: true,  data: <...> }
 *   { success: false, error: { code, message, details? } }
 * so the Agent (or any client) never has to branch on endpoint-specific
 * response shapes to know whether a call succeeded.
 */
function ok(res, data, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

function fail(res, statusCode, code, message, details) {
  return res.status(statusCode).json({
    success: false,
    error: { code, message, ...(details !== undefined ? { details } : {}) },
  });
}

module.exports = { ok, fail };
