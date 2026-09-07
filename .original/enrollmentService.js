const organizationRepository = require('../../models/organizationRepository');
const employeeRepository = require('../../models/employeeRepository');
const deviceRepository = require('../../models/deviceRepository');
const enrollmentRepository = require('../../models/enrollmentRepository');
const auditRepository = require('../../models/auditRepository');
const syncService = require('../sync/syncService');
const { generateDeviceToken } = require('../../utils/crypto');
const { env } = require('../../config/env');
const { notFound, forbidden } = require('../../utils/errors');

/**
 * Idempotent: enrolling the same device_id again (a reinstall, or the
 * Agent asking for a fresh token) updates the existing device record and
 * revokes its old tokens rather than erroring, matching the Agent's own
 * "registration is idempotent" expectation.
 */
async function enroll({ organizationCode, employeeId, activationCode, deviceId, hostname, os, osVersion, arch, agentVersion }) {
  let orgCode = organizationCode;
  let empCode = employeeId;
  let organization = null;
  let employee = null;

  if (activationCode) {
    const clean = activationCode.trim().replace(/^TF[-_]/i, "");

    // Strategy 1: Look for an active organization whose code is a prefix of the clean string
    const { prisma } = require("../../config/prisma");
    const allOrgs = await prisma.organization.findMany({ where: { status: "ACTIVE" } });

    for (const org of allOrgs) {
      const codeUpper = org.organizationCode.toUpperCase();
      const cleanUpper = clean.toUpperCase();
      if (cleanUpper === codeUpper) {
        organization = org;
        break;
      }
      if (cleanUpper.startsWith(codeUpper + "-") || cleanUpper.startsWith(codeUpper + "_") || cleanUpper.startsWith(codeUpper + ":")) {
        organization = org;
        empCode = clean.slice(org.organizationCode.length + 1);
        break;
      }
    }

    // Strategy 2: If organization not found by prefix, try simple split on delimiters
    if (!organization && !orgCode) {
      const parts = clean.split(/[-_:]/);
      if (parts.length >= 2) {
        // Try various split points
        for (let i = parts.length - 1; i >= 1; i--) {
          const testOrgCode = parts.slice(0, i).join("-");
          const testEmpCode = parts.slice(i).join("-");
          const foundOrg = allOrgs.find((o) => o.organizationCode.toUpperCase() === testOrgCode.toUpperCase());
          if (foundOrg) {
            organization = foundOrg;
            empCode = testEmpCode;
            break;
          }
        }
      }
    }

    // Strategy 3: Search if clean matches an employee code directly across active orgs
    if (!organization || !empCode) {
      const matchingEmployees = await prisma.employee.findMany({
        where: {
          OR: [
            { employeeCode: clean },
            { employeeCode: clean.toUpperCase() },
            ...(empCode ? [{ employeeCode: empCode }, { employeeCode: empCode.toUpperCase() }] : []),
          ],
          status: "ACTIVE",
        },
        include: { organization: true },
      });
      if (matchingEmployees.length >= 1) {
        employee = matchingEmployees[0];
        organization = employee.organization;
      }
    }
  }

  if (!organization && orgCode) {
    organization = await organizationRepository.findByCode(orgCode.toUpperCase()) || await organizationRepository.findByCode(orgCode);
  }

  if (organization && !employee && empCode) {
    employee = await employeeRepository.findByCode(organization.id, empCode) || await employeeRepository.findByCode(organization.id, empCode.toUpperCase());
  }

  if (!organization) throw notFound("Unknown organization code or activation code");
  if (organization.status !== "ACTIVE") throw forbidden("This organization is not active");

  if (!employee) throw notFound("Unknown employee_id or activation code for this organization");
  if (employee.status !== "ACTIVE") throw forbidden("This employee is not active");

  let device = await deviceRepository.findByCode(organization.id, deviceId);
  let alreadyRegistered = false;

  if (device) {
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

  await enrollmentRepository.record(organization.id, { employeeCode: employee.employeeCode, deviceCode: deviceId });
  await auditRepository.record({
    organizationId: organization.id,
    actorType: "AGENT",
    actorId: device.id,
    action: alreadyRegistered ? "DEVICE_RE_ENROLLED" : "DEVICE_ENROLLED",
    metadata: { deviceCode: deviceId, employeeCode: employee.employeeCode },
  });

  // Push to the organization Zoho device_registry through the durable queue
  await syncService.enqueueEvent(organization.id, {
    device,
    employee,
    eventType: "device_register",
    eventId: `device_register:${device.id}:${Date.now()}`,
    data: { device_name: hostname, operating_system: os, os_version: osVersion, agent_version: agentVersion },
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
