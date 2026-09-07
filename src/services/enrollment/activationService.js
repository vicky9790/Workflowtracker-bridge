const crypto = require('crypto');
const { prisma } = require('../../config/prisma');
const { sha256 } = require('../../utils/crypto');
const { notFound, forbidden, badRequest } = require('../../utils/errors');

/**
 * One-time activation codes (PART 7).
 *
 * Format: TF-XXXX-XXXX using Crockford-style base32 with I/L/O/U removed,
 * so a code read off a screen or over the phone cannot be mistyped into a
 * different valid code. 8 random characters from a 28-symbol alphabet is
 * ~38 bits, which is far too sparse to guess against a rate-limited
 * endpoint, and the code is single-use and short-lived on top of that.
 *
 * Only the SHA-256 hash is stored. The plaintext is returned exactly once,
 * to the admin that generated it, and is never written to a log.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'.replace(/[ILOU]/g, '');
const DEFAULT_TTL_HOURS = 72;

function randomChars(n) {
  const bytes = crypto.randomBytes(n * 2);
  let out = '';
  for (let i = 0; out.length < n; i += 1) {
    const v = bytes[i % bytes.length];
    // Rejection-sample to keep the distribution uniform across the alphabet.
    if (v < 256 - (256 % ALPHABET.length)) out += ALPHABET[v % ALPHABET.length];
  }
  return out;
}

function generateCode() {
  const a = randomChars(4);
  const b = randomChars(4);
  return { code: `TF-${a}-${b}`, hint: `TF-${a}` };
}

function normalize(raw) {
  return String(raw || '').trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * Issues a code bound to exactly one organization AND one employee.
 * Any previously issued ACTIVE code for that employee is revoked, so an
 * employee never has two live codes in circulation.
 */
async function issue(organizationId, employeeId, { ttlHours = DEFAULT_TTL_HOURS, createdBy, employeeName, email } = {}) {
  let employee = await prisma.employee.findFirst({
    where: {
      organizationId,
      OR: [
        { id: employeeId },
        { employeeCode: employeeId },
      ],
    },
  });

  if (!employee) {
    if (createdBy === 'CREATOR_INTEGRATION' && employeeName) {
      employee = await prisma.employee.create({
        data: {
          organizationId,
          employeeCode: employeeId,
          fullName: employeeName,
          email: email || null,
        },
      });
    } else {
      throw notFound('Employee not found in this organization');
    }
  }

  await prisma.activationCode.updateMany({
    where: { organizationId, employeeId: employee.id, status: 'ACTIVE' },
    data: { status: 'REVOKED' },
  });

  const { code, hint } = generateCode();
  const row = await prisma.activationCode.create({
    data: {
      organizationId,
      employeeId: employee.id,
      codeHash: sha256(normalize(code)),
      codeHint: hint,
      expiresAt: new Date(Date.now() + ttlHours * 3600 * 1000),
      createdBy: createdBy || null,
    },
  });

  // `code` is returned, never stored and never logged.
  return {
    activation_code: code,
    activation_id: row.id,
    expires_at: row.expiresAt,
    employee_id: employee.employeeCode,
  };
}

/**
 * Validates and atomically consumes a code.
 *
 * The lookup is by hash, which means one indexed read that lands on
 * exactly one organization. There is no scan across tenants and no string
 * parsing, so the cross-tenant mis-enrollment the old implementation
 * allowed is structurally impossible now.
 *
 * Consumption is a conditional update (status ACTIVE -> USED) rather than
 * a read-then-write, so two Agents racing on the same code cannot both
 * succeed.
 */
async function consume(rawCode, deviceCodeForAudit) {
  const code = normalize(rawCode);
  if (!/^TF-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(code)) {
    throw badRequest('Activation code format is not valid');
  }

  const row = await prisma.activationCode.findUnique({
    where: { codeHash: sha256(code) },
    include: { organization: true, employee: true },
  });

  // Same message for "no such code" and "wrong code" so the endpoint
  // cannot be used to probe which codes exist.
  if (!row) throw notFound('Activation code is not valid');

  if (row.status === 'USED') throw forbidden('This activation code has already been used');
  if (row.status === 'REVOKED') throw forbidden('This activation code has been revoked');
  if (row.expiresAt.getTime() < Date.now()) {
    await prisma.activationCode.update({
      where: { id: row.id },
      data: { status: 'EXPIRED' },
    });
    throw forbidden('This activation code has expired');
  }
  if (row.organization.status !== 'ACTIVE') {
    throw forbidden('This organization is not active');
  }
  if (row.employee.status !== 'ACTIVE') {
    throw forbidden('This employee is not active');
  }

  const claimed = await prisma.activationCode.updateMany({
    where: { id: row.id, status: 'ACTIVE' },
    data: { status: 'USED', usedAt: new Date(), usedByDeviceId: deviceCodeForAudit || null },
  });
  if (claimed.count !== 1) {
    throw forbidden('This activation code has already been used');
  }

  return { organization: row.organization, employee: row.employee, activationId: row.id };
}

module.exports = { issue, consume, generateCode };
