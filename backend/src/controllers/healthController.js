// GET /api/health — used by Docker and the load balancer to check this copy of the app.
const db = require('../db/pool');

const DB_CHECK_TIMEOUT_MS = 3000;

async function health(req, res) {
  const base = { uptime: Math.round(process.uptime()), timestamp: new Date().toISOString() };
  try {
    await Promise.race([
      db.query('SELECT 1'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Database check timed out')), DB_CHECK_TIMEOUT_MS).unref()),
    ]);
    res.status(200).json({ status: 'ok', db: 'up', ...base });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'down', ...base });
  }
}

module.exports = { health };
