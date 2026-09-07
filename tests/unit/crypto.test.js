process.env.ENCRYPTION_KEY = 'a'.repeat(64); // valid 32-byte hex key for this test file only
process.env.NODE_ENV = 'test';

const { encrypt, decrypt, sha256, generateDeviceToken, generateOrganizationCode } = require('../../src/utils/crypto');

describe('crypto utils', () => {
  test('encrypt/decrypt round-trips a refresh token', () => {
    const plaintext = '1000.abcdef1234567890.fedcba0987654321';
    const stored = encrypt(plaintext);
    expect(stored).not.toContain(plaintext);
    expect(decrypt(stored)).toBe(plaintext);
  });

  test('encrypt produces a different ciphertext each time (random IV)', () => {
    const a = encrypt('same-value');
    const b = encrypt('same-value');
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe('same-value');
    expect(decrypt(b)).toBe('same-value');
  });

  test('decrypt rejects a tampered value', () => {
    const stored = encrypt('secret');
    const [iv, tag, ct] = stored.split(':');
    const tampered = `${iv}:${tag}:${ct.slice(0, -2)}00`;
    expect(() => decrypt(tampered)).toThrow();
  });

  test('sha256 is deterministic', () => {
    expect(sha256('abc')).toBe(sha256('abc'));
    expect(sha256('abc')).not.toBe(sha256('abd'));
  });

  test('generateDeviceToken returns a raw token whose hash matches sha256(raw)', () => {
    const { raw, hash } = generateDeviceToken();
    expect(raw).toHaveLength(64); // 32 bytes hex
    expect(hash).toBe(sha256(raw));
  });

  test('generateOrganizationCode is uppercase, slugged, and reasonably unique', () => {
    const a = generateOrganizationCode('Acme Corp!!');
    const b = generateOrganizationCode('Acme Corp!!');
    expect(a).toMatch(/^[A-Z0-9]+-[A-F0-9]+$/i);
    expect(a).not.toBe(b); // random suffix
  });
});
