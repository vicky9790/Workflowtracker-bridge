const express = require('express');
const controller = require('../controllers/zoho.controller');
const { requireAdminAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');

const router = express.Router();

// /callback is hit by Zoho's own redirect (a browser navigation, no
// Authorization header we control) and is authenticated instead via the
// signed `state` value it round-trips - see zoho.controller.js.
router.get('/callback', controller.callback);

router.get('/connect', requireAdminAuth, requireRole('ORG_ADMIN'), controller.connect);
router.get('/status', requireAdminAuth, requireRole('ORG_ADMIN', 'SUPER_ADMIN'), controller.status);
router.delete('/disconnect', requireAdminAuth, requireRole('ORG_ADMIN'), controller.disconnect);

module.exports = router;
