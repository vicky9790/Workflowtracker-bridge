const express = require('express');

const organizationsRoutes = require('./organizations.routes');
const zohoRoutes = require('./zoho.routes');
const employeesRoutes = require('./employees.routes');
const devicesRoutes = require('./devices.routes');
const agentRoutes = require('./agent.routes');
const activityRoutes = require('./activity.routes');
const syncRoutes = require('./sync.routes');

const api = express.Router();

api.use('/organizations', organizationsRoutes);
api.use('/zoho', zohoRoutes);
api.use('/employees', employeesRoutes);
api.use('/devices', devicesRoutes);
// Both mounted at /api/agent: agentRoutes owns /enroll, /device,
// /heartbeat; activityRoutes owns /work-session, /browser-activity, etc.
// Kept as separate files because they're different concerns (device
// lifecycle vs. activity ingestion), not because the URL space is split.
api.use('/agent', agentRoutes);
api.use('/agent', activityRoutes);
api.use('/sync', syncRoutes);

module.exports = { api };
