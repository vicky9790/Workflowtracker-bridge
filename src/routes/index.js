const express = require('express');

const organizationsRoutes = require('./organizations.routes');
const zohoRoutes = require('./zoho.routes');
const employeesRoutes = require('./employees.routes');
const devicesRoutes = require('./devices.routes');
const agentRoutes = require('./agent.routes');
const activityRoutes = require('./activity.routes');
const syncRoutes = require('./sync.routes');
const integrationsRoutes = require('./integrations.routes');
const platformRoutes = require('./platform.routes');

const api = express.Router();

api.use('/organizations', organizationsRoutes);
api.use('/zoho', zohoRoutes);
api.use('/employees', employeesRoutes);
api.use('/devices', devicesRoutes);
api.use('/integrations', integrationsRoutes);
api.use('/platform', platformRoutes);

// Device lifecycle: /api/agent/enroll, /device, /heartbeat
api.use('/agent', agentRoutes);

// Activity ingestion.
//
// FIXED 06-Sep-2026 - URL space did not match the contract.
// Both routers were mounted at /api/agent, so the real ingestion URLs were
// /api/agent/work-session and /api/agent/activity/batch. Every document,
// the Postman collection and PART 32 of the spec say /api/activity/*.
// Canonical mount is now /api/activity; /api/agent stays as a deprecated
// alias so Agents already in the field keep working through the rollout.
api.use('/activity', activityRoutes);
api.use('/agent', activityRoutes);

api.use('/sync', syncRoutes);

module.exports = { api };
