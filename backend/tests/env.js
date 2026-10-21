// Test settings. Loaded before any app module (see helpers.js).
// Real values can be passed in from the shell / CI; secrets are generated per run.
const crypto = require('crypto');

process.env.NODE_ENV = 'test';
process.env.DB_HOST ||= 'localhost';
process.env.DB_PORT ||= '5432';
process.env.DB_NAME ||= 'eventra_test';
process.env.DB_USER ||= 'eventra';

// Safety net: the tests wipe tables, so never run them against a real database.
if (!/_test$/.test(process.env.DB_NAME)) {
  throw new Error(`Refusing to run tests: DB_NAME "${process.env.DB_NAME}" must end with "_test"`);
}

process.env.JWT_SECRET ||= crypto.randomBytes(32).toString('hex');
process.env.ADMIN_EMAIL ||= 'admin@eventra.test';
process.env.ADMIN_PASSWORD ||= `Test-${crypto.randomBytes(8).toString('hex')}`;
process.env.SEED_SAMPLE_DATA = 'false';

// High limits so normal tests are never throttled (rateLimit.test.js lowers them).
process.env.RATE_LIMIT_LOGIN_MAX ||= '10000';
process.env.RATE_LIMIT_REGISTER_MAX ||= '10000';
process.env.RATE_LIMIT_API_MAX ||= '100000';
