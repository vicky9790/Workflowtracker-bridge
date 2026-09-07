const { AppError } = require('../utils/errors');
const { fail } = require('../utils/respond');
const { logger } = require('../config/logger');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, path: req.path }, 'request failed');
    } else {
      logger.warn(
        { code: err.code, path: req.path, message: err.message, details: err.details },
        'request rejected'
      );
    }
    return fail(res, err.statusCode, err.code, err.message, err.details);
  }

  if (err && err.type === 'entity.too.large') {
    return fail(res, 413, 'PAYLOAD_TOO_LARGE', 'Request body exceeds the size limit');
  }

  if (err && err.type === 'entity.parse.failed') {
    return fail(res, 400, 'INVALID_JSON', 'Request body is not valid JSON');
  }

  logger.error({ err, path: req.path }, 'unhandled error');
  return fail(res, 500, 'INTERNAL_ERROR', 'Something went wrong');
}

function notFoundHandler(req, res) {
  return fail(res, 404, 'NOT_FOUND', `No route for ${req.method} ${req.path}`);
}

module.exports = { errorHandler, notFoundHandler };
