/**
 * Wraps an async Express handler so a thrown/rejected error is forwarded
 * to next() instead of becoming an unhandled rejection.
 */
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };
