const deviceRepository = require('../models/deviceRepository');
const auditRepository = require('../models/auditRepository');
const { ok } = require('../utils/respond');
const { asyncHandler } = require('../utils/asyncHandler');
const { notFound } = require('../utils/errors');

const list = asyncHandler(async (req, res) => {
  const organizationId = req.admin.organizationId;
  const { skip, take } = req.query;
  const [items, total] = await Promise.all([
    deviceRepository.list(organizationId, { skip, take }),
    deviceRepository.count(organizationId),
  ]);
  ok(res, { items, total, skip, take });
});

const getById = asyncHandler(async (req, res) => {
  const device = await deviceRepository.findById(req.admin.organizationId, req.params.id);
  if (!device) throw notFound('Device not found');
  ok(res, device);
});

/** Enable/disable - the only device field an admin can change directly.
 *  Everything else (hostname, os, agent_version) is written by the Agent
 *  itself via enroll/heartbeat, not editable from the admin UI. */
const updateStatus = asyncHandler(async (req, res) => {
  const organizationId = req.admin.organizationId;
  const existing = await deviceRepository.findById(organizationId, req.params.id);
  if (!existing) throw notFound('Device not found');

  const updated = await deviceRepository.setStatus(organizationId, req.params.id, req.body.status);
  await auditRepository.record({
    organizationId,
    actorType: req.admin.role,
    actorId: req.admin.id,
    action: req.body.status === 'DISABLED' ? 'DEVICE_DISABLED' : 'DEVICE_STATUS_CHANGED',
    metadata: { deviceCode: existing.deviceCode, status: req.body.status },
  });
  ok(res, updated);
});

/** Revokes every active token for the device - the device must
 *  re-enroll (POST /api/agent/enroll with the same device_id) to get a
 *  new one. Does not delete or disable the device record itself. */
const revokeToken = asyncHandler(async (req, res) => {
  const organizationId = req.admin.organizationId;
  const existing = await deviceRepository.findById(organizationId, req.params.id);
  if (!existing) throw notFound('Device not found');

  const result = await deviceRepository.revokeTokensForDevice(organizationId, req.params.id);
  await auditRepository.record({
    organizationId,
    actorType: req.admin.role,
    actorId: req.admin.id,
    action: 'DEVICE_TOKEN_REVOKED',
    metadata: { deviceCode: existing.deviceCode, tokensRevoked: result.count },
  });
  ok(res, { revoked: result.count });
});

module.exports = { list, getById, updateStatus, revokeToken };
