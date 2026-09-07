const enrollmentService = require('../services/enrollment/enrollmentService');
const deviceRepository = require('../models/deviceRepository');
const { forOrganization } = require('../services/zoho/zohoService');
const { ok } = require('../utils/respond');
const { asyncHandler } = require('../utils/asyncHandler');
const { logger } = require('../config/logger');

const enroll = asyncHandler(async (req, res) => {
  const b = req.body;
  const result = await enrollmentService.enroll({
    organizationCode: b.organization_code,
    employeeId: b.employee_id,
    activationCode: b.activation_code,
    deviceId: b.device_id,
    hostname: b.hostname,
    os: b.os,
    osVersion: b.os_version,
    arch: b.arch,
    agentVersion: b.agent_version,
  });
  ok(res, result, 201);
});

const getDevice = asyncHandler(async (req, res) => {
  const organizationRepository = require("../models/organizationRepository");
  const org = await organizationRepository.findById(req.organizationId);
  ok(res, {
    device_id: req.device.deviceCode,
    employee_id: req.employee?.employeeCode || req.employeeId,
    employee_name: req.employee?.fullName || null,
    organization_name: org?.organizationName || null,
    organization_code: org?.organizationCode || null,
    hostname: req.device.hostname,
    status: req.device.status,
    agent_version: req.device.agentVersion,
    last_seen: req.device.lastSeen,
  });
});

const heartbeat = asyncHandler(async (req, res) => {
  const device = await deviceRepository.touchHeartbeat(req.organizationId, req.device.id, {
    agentVersion: req.body.agent_version,
  });

  // Best-effort, synchronous-but-non-blocking push to Zoho. Heartbeats are
  // frequent (every few minutes) and self-healing - if this one fails,
  // the next one corrects it - so it is deliberately NOT put through the
  // durable retry queue the way one-off activity events are.
  forOrganization(req.organizationId)
    .callCustomFunction('device_heartbeat', {
      device_id: device.deviceCode,
      employee_id: req.employeeId,
      status: req.body.status || 'ONLINE',
      agent_version: device.agentVersion,
      timestamp: new Date().toISOString(),
    })
    .catch((err) => {
      // NOT_FOUND means the org hasn't connected Zoho yet - this is an
      // expected steady-state, not an actionable warning. Only escalate
      // to warn for genuine unexpected failures (network errors, 5xx, etc.)
      if (err.code === 'NOT_FOUND') {
        logger.debug({ organizationId: req.organizationId, deviceId: device.id }, 'heartbeat zoho push skipped: no Zoho connection');
      } else {
        logger.warn({ organizationId: req.organizationId, deviceId: device.id, err: err.message }, 'heartbeat zoho push failed, will self-heal next heartbeat');
      }
    });

  ok(res, { last_seen: device.lastSeen, status: device.status });
});

module.exports = { enroll, getDevice, heartbeat };
