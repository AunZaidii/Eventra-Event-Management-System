// Admin authentication endpoints.
const authService = require('../services/authService');

async function login(req, res) {
  const { email, password } = req.valid.body;
  res.json(await authService.login(email, password));
}

async function me(req, res) {
  res.json({ admin: req.admin });
}

module.exports = { login, me };
