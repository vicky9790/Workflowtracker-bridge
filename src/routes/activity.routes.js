const express = require('express');
const controller = require('../controllers/activity.controller');
const { requireDeviceAuth } = require('../middleware/deviceAuth');
const { validate } = require('../middleware/validate');
const schemas = require('../utils/schemas');

const router = express.Router();

router.use(requireDeviceAuth);

router.post('/work-session', validate({ body: schemas.activity.workSession }), controller.workSession);
router.post('/browser-activity', validate({ body: schemas.activity.browserActivity }), controller.browserActivity);
router.post('/application-usage', validate({ body: schemas.activity.applicationUsage }), controller.applicationUsage);
router.post('/keyboard-metrics', validate({ body: schemas.activity.keyboardMetrics }), controller.keyboardMetrics);
router.post('/mouse-metrics', validate({ body: schemas.activity.mouseMetrics }), controller.mouseMetrics);
router.post('/screenshot', validate({ body: schemas.activity.screenshot }), controller.screenshot);
// Was '/activity/batch', which under the /api/agent mount produced the
// nonexistent /api/agent/activity/batch. Mounted at /api/activity this is
// now /api/activity/batch, matching the documented contract.
router.post('/batch', validate({ body: schemas.activity.batch }), controller.batch);

module.exports = router;
