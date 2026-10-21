// Registration business logic: safe seat booking, duplicate checks, listing and CSV export.
const db = require('../db/pool');
const AppError = require('../utils/AppError');
const { generateRegistrationCode } = require('../utils/registrationCode');
const { toCsv } = require('../utils/csv');
const eventService = require('./eventService');

const MAX_CODE_ATTEMPTS = 5;

function toRegistration(row) {
  return {
    id: row.id,
    eventId: row.event_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    code: row.code,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

const duplicateError = () =>
  AppError.conflict('DUPLICATE_REGISTRATION', 'This email is already registered for this event.');

async function register(eventId, { name, email, phone }) {
  const registration = await db.withTransaction(async (client) => {
    // FOR UPDATE locks this event row until we commit, so two people can never
    // take the last seat at the same moment, even across several app copies.
    const { rows } = await client.query('SELECT id, starts_at, capacity FROM events WHERE id = $1 FOR UPDATE', [
      eventId,
    ]);
    const event = rows[0];
    if (!event) throw AppError.notFound('Event not found.', 'EVENT_NOT_FOUND');
    if (new Date(event.starts_at).getTime() < Date.now()) {
      throw AppError.badRequest('EVENT_PAST', 'This event has already taken place.');
    }

    const existing = await client.query('SELECT 1 FROM registrations WHERE event_id = $1 AND email = $2', [
      eventId,
      email,
    ]);
    if (existing.rowCount > 0) throw duplicateError();

    const count = await client.query('SELECT COUNT(*)::int AS n FROM registrations WHERE event_id = $1', [eventId]);
    if (count.rows[0].n >= event.capacity) {
      throw AppError.conflict('EVENT_FULL', 'Sorry, this event is sold out.');
    }

    // Codes are random; on the rare clash with an existing code, try another one.
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
      try {
        const inserted = await client.query(
          `INSERT INTO registrations (event_id, name, email, phone, code)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (code) DO NOTHING
           RETURNING *`,
          [eventId, name, email, phone, generateRegistrationCode()],
        );
        if (inserted.rows[0]) return toRegistration(inserted.rows[0]);
      } catch (err) {
        if (err.code === '23505' && err.constraint === 'registrations_event_email_key') throw duplicateError();
        throw err;
      }
    }
    throw new Error('Could not generate a unique registration code');
  });

  const event = await eventService.getById(eventId);
  return { code: registration.code, registration, event };
}

async function listForEvent(eventId, { q, page, limit }) {
  await eventService.getById(eventId); // 404 if the event does not exist

  const params = [eventId];
  let filter = '';
  if (q) {
    params.push(eventService.likePattern(q));
    filter = 'AND (name ILIKE $2 OR email ILIKE $2 OR code ILIKE $2 OR phone ILIKE $2)';
  }
  const offset = (page - 1) * limit;
  const [items, count] = await Promise.all([
    db.query(
      `SELECT * FROM registrations WHERE event_id = $1 ${filter}
       ORDER BY created_at DESC, id DESC LIMIT ${limit} OFFSET ${offset}`,
      params,
    ),
    db.query(`SELECT COUNT(*)::int AS total FROM registrations WHERE event_id = $1 ${filter}`, params),
  ]);
  return { items: items.rows.map(toRegistration), page, limit, total: count.rows[0].total };
}

// File-name-safe version of the event title, e.g. "cloud-native-summit-2026".
function slugify(text) {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'event'
  );
}

async function exportCsv(eventId) {
  const event = await eventService.getById(eventId);
  const { rows } = await db.query(
    'SELECT name, email, phone, code, created_at FROM registrations WHERE event_id = $1 ORDER BY created_at ASC, id ASC',
    [eventId],
  );
  const csv = toCsv(
    ['Name', 'Email', 'Phone', 'Registration code', 'Registered at (UTC)'],
    rows.map((r) => [r.name, r.email, r.phone, r.code, new Date(r.created_at).toISOString()]),
  );
  return { filename: `${slugify(event.title)}-registrations.csv`, csv };
}

module.exports = { register, listForEvent, exportCsv, slugify };
