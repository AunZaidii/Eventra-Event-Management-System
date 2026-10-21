// Shared test helpers: app instance, database reset and data factories.
require('./env');

const request = require('supertest');
const { createApp } = require('../src/app');
const db = require('../src/db/pool');
const { runMigrations } = require('../src/db/migrate');
const { seedAdmin } = require('../src/db/seed');

const app = createApp();
const quiet = { log: () => {} };

const DAY = 24 * 60 * 60 * 1000;
const daysFromNow = (days) => new Date(Date.now() + days * DAY).toISOString();

// Run once per test file: schema + admin user.
async function setupDatabase() {
  await runMigrations(quiet);
  await seedAdmin(quiet);
}

// Run before each test: empty events and registrations.
async function clearData() {
  await db.query('TRUNCATE registrations, events RESTART IDENTITY CASCADE');
}

async function createEvent(overrides = {}) {
  const e = {
    title: 'Test Event',
    description: 'A description long enough to pass validation.',
    category: 'Conference',
    startsAt: daysFromNow(7),
    location: 'Test Hall',
    capacity: 10,
    bannerUrl: null,
    ...overrides,
  };
  const { rows } = await db.query(
    `INSERT INTO events (title, description, category, starts_at, location, capacity, banner_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [e.title, e.description, e.category, e.startsAt, e.location, e.capacity, e.bannerUrl],
  );
  return { ...e, id: rows[0].id };
}

async function addRegistrations(eventId, count) {
  for (let i = 0; i < count; i += 1) {
    await db.query('INSERT INTO registrations (event_id, name, email, phone, code) VALUES ($1, $2, $3, $4, $5)', [
      eventId,
      `Person ${i}`,
      `person${i}@example.com`,
      '+92 300 0000000',
      `EVT-T${String(eventId).padStart(2, '0')}${String(i).padStart(3, '0')}`.slice(0, 12),
    ]);
  }
}

const register = (eventId, body) => request(app).post(`/api/events/${eventId}/registrations`).send(body);

const validPerson = (overrides = {}) => ({
  name: 'Sara Ahmed',
  email: 'sara@example.com',
  phone: '+92 300 1234567',
  ...overrides,
});

async function adminToken() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
  if (res.status !== 200) throw new Error(`Admin login failed in test setup: ${res.status}`);
  return res.body.token;
}

async function closeDatabase() {
  await db.pool.end();
}

module.exports = {
  app,
  request,
  db,
  daysFromNow,
  setupDatabase,
  clearData,
  createEvent,
  addRegistrations,
  register,
  validPerson,
  adminToken,
  closeDatabase,
};
