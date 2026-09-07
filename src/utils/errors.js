class AppError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

const badRequest = (message, details) => new AppError(400, 'BAD_REQUEST', message, details);
const unauthorized = (message = 'Unauthorized') => new AppError(401, 'UNAUTHORIZED', message);
const forbidden = (message = 'Forbidden') => new AppError(403, 'FORBIDDEN', message);
const notFound = (message = 'Not found') => new AppError(404, 'NOT_FOUND', message);
const conflict = (message, details) => new AppError(409, 'CONFLICT', message, details);
const tooManyRequests = (message = 'Too many requests') => new AppError(429, 'RATE_LIMITED', message);
const badGateway = (message = 'Upstream error') => new AppError(502, 'BAD_GATEWAY', message);
const serviceUnavailable = (message = 'Service temporarily unavailable') =>
  new AppError(503, 'SERVICE_UNAVAILABLE', message);

module.exports = {
  AppError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  tooManyRequests,
  badGateway,
  serviceUnavailable,
};
