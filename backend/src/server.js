// Starts the API: wait for the database → run migrations → seed → listen.
const config = require('./config');
const db = require('./db/pool');
const { runMigrations } = require('./db/migrate');
const { seedAdmin, seedSampleEvents } = require('./db/seed');
const { createApp } = require('./app');

const DB_RETRIES = 15;
const DB_RETRY_DELAY_MS = 2000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForDatabase() {
  for (let attempt = 1; attempt <= DB_RETRIES; attempt += 1) {
    try {
      await db.query('SELECT 1');
      return;
    } catch (err) {
      console.log(`Waiting for database (${attempt}/${DB_RETRIES}): ${err.message || err.code || err}`);
      await sleep(DB_RETRY_DELAY_MS);
    }
  }
  throw new Error('Database is not reachable');
}

async function start() {
  await waitForDatabase();
  await runMigrations();
  await seedAdmin();
  if (config.seedSampleData) await seedSampleEvents();

  const server = createApp().listen(config.port, () => {
    console.log(`Eventra API listening on port ${config.port} (${config.env})`);
  });

  // Graceful shutdown: finish open requests, then close DB connections.
  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down`);
    server.close(() => {
      db.pool.end().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});
