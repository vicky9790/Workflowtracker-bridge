const express = require('express');
const controller = require('../controllers/platform.controller');
const { requireAdminAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');

const router = express.Router();

// All platform console endpoints strictly require SUPER_ADMIN
router.use(requireAdminAuth, requireRole('SUPER_ADMIN'));

router.get('/overview', controller.getOverview);
router.get('/organizations', controller.listOrganizations);
router.get('/organizations/:id', controller.getOrganizationById);
router.patch('/organizations/:id/status', controller.updateOrganizationStatus);
router.get('/employees', controller.listEmployees);
router.get('/devices', controller.listDevices);
router.patch('/devices/:id/status', controller.updateDeviceStatus);
router.post('/devices/:id/revoke-token', controller.revokeDeviceToken);
router.get('/zoho-connections', controller.listZohoConnections);
router.get('/audit-logs', controller.listAuditLogs);

module.exports = router;

