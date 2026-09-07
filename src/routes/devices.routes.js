const express = require('express');
const controller = require('../controllers/devices.controller');
const { requireAdminAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');
const { validate } = require('../middleware/validate');
const schemas = require('../utils/schemas');

const router = express.Router();

router.use(requireAdminAuth, requireRole('ORG_ADMIN'));

router.get('/', validate({ query: schemas.devices.list }), controller.list);
router.get('/:id', validate({ params: schemas.devices.idParam }), controller.getById);
router.patch('/:id/status', validate({ params: schemas.devices.idParam, body: schemas.devices.updateStatus }), controller.updateStatus);
router.post('/:id/revoke-token', validate({ params: schemas.devices.idParam }), controller.revokeToken);

module.exports = router;
