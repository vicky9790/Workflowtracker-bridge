const express = require('express');
const controller = require('../controllers/agent.controller');
const { requireDeviceAuth } = require('../middleware/deviceAuth');
const { validate } = require('../middleware/validate');
const schemas = require('../utils/schemas');
const { strict } = require('../middleware/rateLimit');

const router = express.Router();

// Enrollment happens before the Agent has a device token, so it cannot be
// device-auth gated - organization_code + employee_id are what's being
// validated here instead. Rate-limited strictly since it creates rows.
router.post('/enroll', strict, validate({ body: schemas.agent.enroll }), controller.enroll);

router.get('/device', requireDeviceAuth, controller.getDevice);
router.post('/heartbeat', requireDeviceAuth, validate({ body: schemas.agent.heartbeat }), controller.heartbeat);

module.exports = router;
