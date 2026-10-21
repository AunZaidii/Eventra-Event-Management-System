// Request limits per client IP. Counts are kept in memory per app copy,
// which is enough here; a shared store (e.g. Redis) can be plugged in later.
const rateLimit = require('express-rate-limit');
const config = require('../config');

function limiter(windowMs, max, message) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({ error: { code: 'RATE_LIMITED', message } });
    },
  });
}

const rl = config.rateLimit;

module.exports = {
  loginLimiter: limiter(rl.windowLoginMs, rl.loginMax, 'Too many login attempts. Please wait 15 minutes and try again.'),
  registrationLimiter: limiter(rl.windowRegisterMs, rl.registerMax, 'Too many registration attempts. Please wait a few minutes and try again.'),
  apiLimiter: limiter(rl.windowApiMs, rl.apiMax, 'Too many requests. Please slow down and try again shortly.'),
};
