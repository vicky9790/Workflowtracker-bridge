const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const organizationRepository = require('../../models/organizationRepository');
const adminRepository = require('../../models/adminRepository');
const auditRepository = require('../../models/auditRepository');
const { env } = require('../../config/env');
const { generateOrganizationCode } = require('../../utils/crypto');
const { conflict, unauthorized, forbidden } = require('../../utils/errors');

const BCRYPT_ROUNDS = 12;
const TOKEN_TTL = '12h';

function issueToken(admin) {
  return jwt.sign(
    { sub: admin.id, type: 'admin', role: admin.role, organizationId: admin.organizationId, email: admin.email },
    env.JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

/** Creates the organization and its first ORG_ADMIN in one transaction-ish
 *  step (Prisma create calls are individually atomic; if the admin create
 *  fails the caller should treat the whole registration as failed - see
 *  organizations.controller.js). */
async function registerOrganization({ organizationName, email, password }) {
  const existingAdmin = await adminRepository.findByEmail(email);
  if (existingAdmin) {
    throw conflict('An account with this email already exists');
  }

  let organizationCode = generateOrganizationCode(organizationName);
  // Vanishingly unlikely to collide (6 random hex chars), but don't ship
  // an unhandled unique-constraint 500 if it ever does.
  for (let attempt = 0; attempt < 5; attempt++) {
    const clash = await organizationRepository.findByCode(organizationCode);
    if (!clash) break;
    organizationCode = generateOrganizationCode(organizationName);
  }

  const organization = await organizationRepository.create({ organizationName, organizationCode });
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const admin = await adminRepository.create({
    organizationId: organization.id,
    email,
    passwordHash,
    role: 'ORG_ADMIN',
  });

  await auditRepository.record({
    organizationId: organization.id,
    actorType: 'ORG_ADMIN',
    actorId: admin.id,
    action: 'ORGANIZATION_REGISTERED',
    metadata: { organizationCode },
  });

  const token = issueToken(admin);
  return { organization, admin, token };
}

async function login({ email, password }) {
  const admin = await adminRepository.findByEmail(email);
  if (!admin) throw unauthorized('Invalid email or password');

  const match = await bcrypt.compare(password, admin.passwordHash);
  if (!match) throw unauthorized('Invalid email or password');

  if (admin.role !== 'SUPER_ADMIN') {
    const org = await organizationRepository.findById(admin.organizationId);
    if (!org || org.status !== 'ACTIVE') {
      throw forbidden('This organization is not active');
    }
  }

  await auditRepository.record({
    organizationId: admin.organizationId,
    actorType: admin.role,
    actorId: admin.id,
    action: 'LOGIN',
  });

  const token = issueToken(admin);
  return { admin, token };
}

module.exports = { registerOrganization, login };
