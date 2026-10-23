// Reads every setting from environment variables (nothing is hardcoded).
// A local .env file is loaded if present (backend/.env or the project root .env).
const path = require('path');
const dotenv = require('dotenv');

// Tests get their settings from tests/env.js only.
if (process.env.NODE_ENV !== 'test') {
  dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });
  dotenv.config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });
}

const env = process.env;

function required(name) {
  const value = env[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function toInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
}

function toBool(value, fallback = false) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

const jwtSecret = required('JWT_SECRET');
if (jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long');
}

const config = {
  env: env.NODE_ENV || 'development',
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  port: toInt(env.PORT, 4000),
  // Which proxies may set X-Forwarded-For (so rate limits see the real client IP).
  // Default: any private/loopback address — Nginx, the AWS ALB and the ECS Service
  // Connect proxy all live there, however many hops there are. A number also works.
  trustProxy: /^\d+$/.test(env.TRUST_PROXY || '')
    ? Number(env.TRUST_PROXY)
    : env.TRUST_PROXY || 'loopback, linklocal, uniquelocal',

  db: {
    host: required('DB_HOST'),
    port: toInt(env.DB_PORT, 5432),
    database: required('DB_NAME'),
    user: required('DB_USER'),
    // Password may be empty only when the server uses trust auth (CI test database)
    password: env.DB_PASSWORD || undefined,
    ssl: toBool(env.DB_SSL) ? { rejectUnauthorized: toBool(env.DB_SSL_REJECT_UNAUTHORIZED, false) } : false,
    max: toInt(env.DB_POOL_MAX, 10),
  },

  jwt: {
    secret: jwtSecret,
    expiresIn: env.JWT_EXPIRES_IN || '8h',
  },

  admin: {
    email: env.ADMIN_EMAIL ? env.ADMIN_EMAIL.trim().toLowerCase() : '',
    password: env.ADMIN_PASSWORD || '',
  },

  corsOrigins: (env.CORS_ORIGIN || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  seedSampleData: toBool(env.SEED_SAMPLE_DATA),

  rateLimit: {
    windowLoginMs: toInt(env.RATE_LIMIT_LOGIN_WINDOW_MS, 15 * 60 * 1000),
    loginMax: toInt(env.RATE_LIMIT_LOGIN_MAX, 10),
    windowRegisterMs: toInt(env.RATE_LIMIT_REGISTER_WINDOW_MS, 10 * 60 * 1000),
    registerMax: toInt(env.RATE_LIMIT_REGISTER_MAX, 20),
    windowApiMs: toInt(env.RATE_LIMIT_API_WINDOW_MS, 15 * 60 * 1000),
    apiMax: toInt(env.RATE_LIMIT_API_MAX, 300),
  },
};

module.exports = config;
