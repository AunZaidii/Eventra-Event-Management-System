// Admin login: checks the bcrypt hash and issues a signed JWT (no server session).
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db/pool');
const AppError = require('../utils/AppError');

// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

async function login(email, password) {
  const { rows } = await db.query('SELECT id, email, password_hash FROM admins WHERE email = $1', [email]);
  const admin = rows[0];
  const ok = await bcrypt.compare(password, admin ? admin.password_hash : DUMMY_HASH);
  if (!admin || !ok) {
    throw AppError.unauthorized('Email or password is incorrect.', 'INVALID_CREDENTIALS');
  }

  const token = jwt.sign({ sub: String(admin.id), email: admin.email, role: 'admin' }, config.jwt.secret, {
    algorithm: 'HS256',
    expiresIn: config.jwt.expiresIn,
  });
  const { exp } = jwt.decode(token);
  return {
    token,
    expiresAt: new Date(exp * 1000).toISOString(),
    admin: { id: admin.id, email: admin.email },
  };
}

module.exports = { login };
