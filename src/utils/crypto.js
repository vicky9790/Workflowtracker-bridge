const crypto = require('crypto');
const { env } = require('../config/env');

const ALGO = 'aes-256-gcm';

function getKey() {
  if (!env.ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY is not configured');
  }
  return Buffer.from(env.ENCRYPTION_KEY, 'hex'); // 32 bytes
}

/**
 * Encrypts a string (a Zoho refresh token, specifically) for storage.
 * Output format: iv.hex : authTag.hex : ciphertext.hex - self-contained,
 * a fresh random IV every call, safe to store as one text column.
 */
function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

function decrypt(stored) {
  const [ivHex, authTagHex, ciphertextHex] = String(stored).split(':');
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error('Malformed encrypted value');
  }
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, 'hex')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

/**
 * Device tokens are already high-entropy random values (not human-chosen
 * passwords), so a fast cryptographic hash is the correct tool - unlike
 * bcrypt, it doesn't need to be deliberately slow, and it needs to stay
 * fast because it's checked on every single Agent request.
 */
function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function generateDeviceToken() {
  const raw = crypto.randomBytes(32).toString('hex');
  return { raw, hash: sha256(raw) };
}

function generateOrganizationCode(organizationName) {
  const slug = String(organizationName)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 6) || 'ORG';
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${slug}-${suffix}`;
}

module.exports = {
  encrypt,
  decrypt,
  sha256,
  generateDeviceToken,
  generateOrganizationCode,
};
