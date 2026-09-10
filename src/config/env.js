const dotenv = require('dotenv');
dotenv.config();

const REQUIRED_IN_PRODUCTION = [
  'DATABASE_URL',
  'JWT_SECRET',
  'ENCRYPTION_KEY',
  'ZOHO_CLIENT_ID',
  'ZOHO_CLIENT_SECRET',
  'ZOHO_REDIRECT_URI',
  'API_BASE_URL',
];

function str(name, def = undefined) {
  const v = process.env[name];
  return v === undefined || v === '' ? def : v;
}

function num(name, def) {
  const v = process.env[name];
  if (v === undefined || v === '') return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

const env = {
  NODE_ENV: str('NODE_ENV', 'development'),
  PORT: num('PORT', 3000),

  DATABASE_URL: str('DATABASE_URL'),
  DATABASE_URL_TEST: str('DATABASE_URL_TEST'),

  JWT_SECRET: str('JWT_SECRET'),
  ENCRYPTION_KEY: str('ENCRYPTION_KEY'),

  ZOHO_CLIENT_ID: str('ZOHO_CLIENT_ID'),
  ZOHO_CLIENT_SECRET: str('ZOHO_CLIENT_SECRET'),
  ZOHO_REDIRECT_URI: str('ZOHO_REDIRECT_URI'),
  ZOHO_DEFAULT_DC: str('ZOHO_DEFAULT_DC', 'in'),

  API_BASE_URL: str('API_BASE_URL'),

  DEVICE_TOKEN_TTL_DAYS: num('DEVICE_TOKEN_TTL_DAYS', undefined),

  SYNC_MAX_ATTEMPTS: num('SYNC_MAX_ATTEMPTS', 8),
  SYNC_BASE_BACKOFF_MS: num('SYNC_BASE_BACKOFF_MS', 30_000),
  SYNC_MAX_BACKOFF_MS: num('SYNC_MAX_BACKOFF_MS', 3_600_000),
  SYNC_WORKER_INTERVAL_MS: num('SYNC_WORKER_INTERVAL_MS', 15_000),
  SYNC_WORKER_BATCH_SIZE: num('SYNC_WORKER_BATCH_SIZE', 25),

  // Device presence (PART 13). A device is offline once it misses this
  // many consecutive heartbeats.
  DEFAULT_HEARTBEAT_INTERVAL_MS: num('DEFAULT_HEARTBEAT_INTERVAL_MS', 60_000),
  DEVICE_OFFLINE_MISSED_BEATS: num('DEVICE_OFFLINE_MISSED_BEATS', 3),
  DEVICE_OFFLINE_AFTER_MS: num('DEVICE_OFFLINE_AFTER_MS', 0),
  DEVICE_PRESENCE_INTERVAL_MS: num('DEVICE_PRESENCE_INTERVAL_MS', 60_000),

  // Legacy org-code + employee-id enrollment. OFF by default: it is the
  // weak path that allowed cross-tenant enrollment. Enable only while
  // migrating already-deployed Agents onto activation codes.
  ALLOW_LEGACY_ENROLLMENT: str('ALLOW_LEGACY_ENROLLMENT', 'false') === 'true',

  // Comma-separated allowlist for CORS. Empty means same-origin only.
  CORS_ORIGINS: str('CORS_ORIGINS', ''),

  // Screenshots are base64 and inflate ~33%; 2mb rejected real captures.
  JSON_BODY_LIMIT: str('JSON_BODY_LIMIT', '12mb'),

  RATE_LIMIT_WINDOW_MS: num('RATE_LIMIT_WINDOW_MS', 60_000),
  RATE_LIMIT_MAX: num('RATE_LIMIT_MAX', 300),

  LOG_LEVEL: str('LOG_LEVEL', 'info'),

  SUPER_ADMIN_EMAIL: str('SUPER_ADMIN_EMAIL'),
  SUPER_ADMIN_PASSWORD: str('SUPER_ADMIN_PASSWORD'),

  TRACKFLOW_INTEGRATION_KEY: str('TRACKFLOW_INTEGRATION_KEY', 'trackflow-creator-integration-key-2026'),
};

/**
 * Fails fast on boot rather than surfacing a confusing error the first
 * time a request needs a missing secret. Skipped in NODE_ENV=test, where
 * tests/setup.js provides its own fixed env.
 */
function assertRequiredEnv() {
  if (env.NODE_ENV === 'test') return;
  const missing = REQUIRED_IN_PRODUCTION.filter((k) => !env[k]);
  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.error(`[FATAL] Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
  if (env.ENCRYPTION_KEY && !/^[0-9a-fA-F]{64}$/.test(env.ENCRYPTION_KEY)) {
    // eslint-disable-next-line no-console
    console.error('[FATAL] ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Generate with: openssl rand -hex 32');
    process.exit(1);
  }
}

module.exports = { env, assertRequiredEnv };
