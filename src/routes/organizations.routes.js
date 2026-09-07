const express = require('express');
const controller = require('../controllers/organizations.controller');
const { validate } = require('../middleware/validate');
const schemas = require('../utils/schemas');
const { strict } = require('../middleware/rateLimit');
const { requireAdminAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');

const router = express.Router();

router.post('/register', strict, validate({ body: schemas.organizations.register }), controller.register);
router.post('/login', strict, validate({ body: schemas.organizations.login }), controller.login);

router.get('/me', requireAdminAuth, requireRole('ORG_ADMIN'), controller.getCurrent);
router.patch('/me', requireAdminAuth, requireRole('ORG_ADMIN'), validate({ body: schemas.organizations.update }), controller.update);

router.get('/settings', requireAdminAuth, requireRole('ORG_ADMIN'), controller.getSettings);
router.patch('/settings', requireAdminAuth, requireRole('ORG_ADMIN'), validate({ body: schemas.organizations.settings }), controller.updateSettings);

module.exports = router;
