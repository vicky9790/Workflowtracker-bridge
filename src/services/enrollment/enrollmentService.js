const organizationRepository = require('../../models/organizationRepository');
const employeeRepository = require('../../models/employeeRepository');
const deviceRepository = require('../../models/deviceRepository');
const enrollmentRepository = require('../../models/enrollmentRepository');
const auditRepository = require('../../models/auditRepository');
const activationService = require('./activationService');
const syncService = require('../sync/syncService');
const { generateDeviceToken } = require('../../utils/crypto');
const { env } = require('../../config/env');
const { notFound, forbidden, badRequest } = require('../../utils/errors');

/**
 * Device enrollment.
 *
 * ------------------------------------------------------------------
 * REWRITTEN 06-Sep-2026.
 *
 * BEFORE: activation codes were not an entity. The service loaded EVERY
 *         active organization (`prisma.organization.findMany`) on every
 *         enrol call, then tried three heuristics in turn to guess which
 *         tenant the string belonged to:
 *           1. treat the code as "<orgCode>-<employeeCode>" by prefix,
 *           2. try every possible split point on -, _ or :,
 *           3. give up on the organization entirely and search employees
 *              across ALL tenants by employeeCode, taking the first match.
 *
 *         Step 3 is a cross-tenant enrollment bug, not a theoretical one:
 *         EMP-001 exists in most organizations, so an Agent enrolling with
 *         a stale or mistyped code could be bound to a different
 *         customer's employee and stream that person's activity into the
 *         wrong Zoho account. Steps 1 and 2 accepted a value that was
 *         never secret - "ZOFLOW-8D3790-EMP-001" is printed in the
 *         Agent's own .env - and it never expired or expired-on-use.
 *
 * AFTER:  a code is a hashed, single-use, expiring credential bound at
 *         issue time to exactly one organization and one employee
 *         (activationService). Resolution is a single indexed lookup by
 *         hash. Cross-tenant resolution is impossible because there is
 *         nothing to resolve - the row already names its tenant.
 *
 *         The legacy org-code + employee-id path is retained but is now
 *         explicitly gated behind ALLOW_LEGACY_ENROLLMENT so the Agents
 *         already deployed keep working during rollout, without leaving
 *         the weak path enabled by default in a new deployment.
 * ------------------------------------------------------------------
 */
async function resolveByLegacyCredentials(organizationCode, employeeId) {
  if (!organizationCode || !employeeId) {
    throw badRequest('activation_code is required');
  }
  const organization = await organizationRepository.findByCode(
    String(organizationCode).trim().toUpperCase()
  );
  if (!organization) throw notFound('Activation failed');
  if (organization.status !== 'ACTIVE') throw forbidden('This organization is not active');

  // Scoped to the organization we just resolved - never a global search.
  const employee = await employeeRepository.findByCode(
    organization.id,
    String(employeeId).trim()
  );
  if (!employee) throw notFound('Activation failed');
  if (employee.status !== 'ACTIVE') throw forbidden('This employee is not active');

  return { organization, employee, activationId: null };
}

async function enroll({
  organizationCode, employeeId, activationCode,
  deviceId, hostname, os, osVersion, arch, agentVersion, ipAddress,
}) {
  if (!deviceId) throw badRequest('device_id is required');

  let organization;
  let employee;
  let activationId = null;

  if (activationCode) {
    ({ organization, employee, activationId } = await activationService.consume(
      activationCode, deviceId
    ));
  } else if (env.ALLOW_LEGACY_ENROLLMENT) {
    ({ organization, employee } = await resolveByLegacyCredentials(
      organizationCode, employeeId
    ));
  } else {
    throw badRequest('activation_code is required');
  }

  let device = await deviceRepository.findByCode(organization.id, deviceId);
  let alreadyRegistered = false;

  if (device) {
    // A previously enrolled device keeps its identity (PART 11). Re-enrolment
    // rotates the token but never creates a second device row.
    if (device.employeeId !== employee.id) {
      // The physical machine is being reassigned to a different employee.
      // Allowed, but it is a material change worth an explicit audit entry.
      await auditRepository.record({
        organizationId: organization.id,
        actorType: 'AGENT',
        actorId: device.id,
        action: 'DEVICE_REASSIGNED',
        metadata: {
          deviceCode: deviceId,
          fromEmployeeId: device.employeeId,
          toEmployeeCode: employee.employeeCode,
        },
      });
    }
    alreadyRegistered = true;
    device = await deviceRepository.touchHeartbeat(organization.id, device.id, { agentVersion });
    await deviceRepository.revokeTokensForDevice(organization.id, device.id);
  } else {
    device = await deviceRepository.create(organization.id, {
      employeeId: employee.id,
      deviceCode: deviceId,
      hostname,
      os,
      osVersion,
      arch,
      agentVersion,
    });
  }

  const { raw, hash } = generateDeviceToken();
  const expiresAt = env.DEVICE_TOKEN_TTL_DAYS
    ? new Date(Date.now() + env.DEVICE_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000)
    : null;
  await deviceRepository.createToken(organization.id, device.id, hash, expiresAt);

  await enrollmentRepository.record(organization.id, {
    employeeCode: employee.employeeCode,
    deviceCode: deviceId,
  });
  await auditRepository.record({
    organizationId: organization.id,
    actorType: 'AGENT',
    actorId: device.id,
    action: alreadyRegistered ? 'DEVICE_RE_ENROLLED' : 'DEVICE_ENROLLED',
    metadata: {
      deviceCode: deviceId,
      employeeCode: employee.employeeCode,
      activationId,
    },
  });

  // Push the device into the organization's Creator device_registry through
  // the durable queue. This now survives Zoho being disconnected.
  await syncService.enqueueEvent(organization.id, {
    device,
    employee,
    eventType: 'device_register',
    eventId: `device_register:${device.id}`,
    data: {
      device_name: hostname,
      hostname,
      operating_system: os,
      os,
      os_version: osVersion,
      ip_address: ipAddress,
      agent_version: agentVersion,
      registered_at: device.createdAt?.toISOString?.() || new Date().toISOString(),
      device_status: 'ONLINE',
      monitoring_status: 'ENABLED',
    },
  });

  return {
    employee_id: employee.employeeCode,
    employee_name: employee.fullName,
    organization_name: organization.organizationName,
    organization_code: organization.organizationCode,
    device_id: device.deviceCode,
    device_token: raw,
    already_registered: alreadyRegistered,
  };
}

module.exports = { enroll };
