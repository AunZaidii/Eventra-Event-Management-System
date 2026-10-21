// One shared PostgreSQL connection pool for the whole app.
const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool({
  ...config.db,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  // An idle client lost its connection; the pool will create a new one.
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

function query(text, params) {
  return pool.query(text, params);
}

// Runs fn(client) inside BEGIN/COMMIT, rolling back on any error.
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
