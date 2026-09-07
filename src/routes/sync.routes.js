const express = require('express');
const controller = require('../controllers/sync.controller');
const { requireAdminAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');
const { validate } = require('../middleware/validate');
const schemas = require('../utils/schemas');

const router = express.Router();

router.use(requireAdminAuth, requireRole('ORG_ADMIN', 'SUPER_ADMIN'));

router.get('/status', controller.status);
router.get('/logs', validate({ query: schemas.sync.logsQuery }), controller.listLogs);
router.post('/:organizationId', controller.triggerSync);

module.exports = router;
