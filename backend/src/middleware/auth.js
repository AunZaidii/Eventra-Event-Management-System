// Protects admin routes: requires a valid "Authorization: Bearer <JWT>" header.
const jwt = require('jsonwebtoken');
const config = require('../config');
const AppError = require('../utils/AppError');

module.exports = function requireAdmin(req, res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(AppError.unauthorized());
  }
  try {
    const payload = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
    if (payload.role !== 'admin') return next(AppError.unauthorized());
    req.admin = { id: Number(payload.sub), email: payload.email };
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(AppError.unauthorized('Your session has expired. Please sign in again.', 'TOKEN_EXPIRED'));
    }
    return next(AppError.unauthorized('Invalid session. Please sign in again.', 'INVALID_TOKEN'));
  }
};
