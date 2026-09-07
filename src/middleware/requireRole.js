const { forbidden } = require('../utils/errors');

/**
 * Must run after requireAdminAuth. Usage: requireRole('SUPER_ADMIN') or
 * requireRole('SUPER_ADMIN', 'ORG_ADMIN').
 */
function requireRole(...roles) {
  return function checkRole(req, res, next) {
    if (!req.admin || !roles.includes(req.admin.role)) {
      return next(forbidden('You do not have permission to perform this action'));
    }
    next();
  };
}

module.exports = { requireRole };
