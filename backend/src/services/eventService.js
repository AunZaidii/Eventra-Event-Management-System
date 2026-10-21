// Event business logic and SQL. Seats left is always computed from the
// registrations table, never stored, so it cannot drift.
const db = require('../db/pool');
const AppError = require('../utils/AppError');

const FROM_EVENTS = `
  FROM events e
  LEFT JOIN (
    SELECT event_id, COUNT(*)::int AS count FROM registrations GROUP BY event_id
  ) rc ON rc.event_id = e.id`;

const REGISTERED = 'COALESCE(rc.count, 0)';

// Converts a database row into the JSON shape the API returns.
function toEvent(row) {
  const registeredCount = Number(row.registered_count || 0);
  const seatsLeft = Math.max(0, row.capacity - registeredCount);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    startsAt: new Date(row.starts_at).toISOString(),
    location: row.location,
    capacity: row.capacity,
    bannerUrl: row.banner_url,
    registeredCount,
    seatsLeft,
    isSoldOut: seatsLeft === 0,
    isPast: new Date(row.starts_at).getTime() < Date.now(),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

// Escapes % and _ so user search text is matched literally in ILIKE.
function likePattern(text) {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

// Small helper that numbers SQL parameters ($1, $2 ...) as conditions are added.
function whereBuilder() {
  const conditions = [];
  const params = [];
  return {
    add(sqlWithPlaceholder, ...values) {
      let sql = sqlWithPlaceholder;
      for (const value of values) {
        params.push(value);
        sql = sql.replace('?', `$${params.length}`);
      }
      conditions.push(sql);
    },
    params,
    get sql() {
      return conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    },
  };
}

function addSearch(where, q) {
  if (!q) return;
  const pattern = likePattern(q);
  where.add('(e.title ILIKE ? OR e.location ILIKE ? OR e.description ILIKE ?)', pattern, pattern, pattern);
}

async function paginate(where, orderBy, page, limit) {
  const offset = (page - 1) * limit;
  const [items, count] = await Promise.all([
    db.query(
      `SELECT e.*, ${REGISTERED} AS registered_count ${FROM_EVENTS} ${where.sql}
       ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${offset}`,
      where.params,
    ),
    db.query(`SELECT COUNT(*)::int AS total ${FROM_EVENTS} ${where.sql}`, where.params),
  ]);
  return { items: items.rows.map(toEvent), page, limit, total: count.rows[0].total };
}

// Public list: upcoming events only, with search / category / date filters.
async function listPublic({ q, category, from, to, sort, page, limit }) {
  const where = whereBuilder();
  where.add('e.starts_at >= now()');
  addSearch(where, q);
  if (category) where.add('e.category = ?', category);
  if (from) where.add('e.starts_at >= ?::date', from);
  if (to) where.add("e.starts_at < (?::date + INTERVAL '1 day')", to);

  const orderBy =
    sort === 'seats' ? `(e.capacity - ${REGISTERED}) DESC, e.starts_at ASC` : 'e.starts_at ASC, e.id ASC';
  return paginate(where, orderBy, page, limit);
}

// Admin list: all events (upcoming first, then past), with a status filter.
async function listAdmin({ q, status, page, limit }) {
  const where = whereBuilder();
  addSearch(where, q);
  if (status === 'upcoming') where.add('e.starts_at >= now()');
  if (status === 'past') where.add('e.starts_at < now()');
  if (status === 'soldout') where.add(`${REGISTERED} >= e.capacity`);

  const orderBy = `(e.starts_at < now()) ASC,
    CASE WHEN e.starts_at >= now() THEN e.starts_at END ASC,
    e.starts_at DESC, e.id DESC`;
  return paginate(where, orderBy, page, limit);
}

async function getById(id) {
  const { rows } = await db.query(
    `SELECT e.*, ${REGISTERED} AS registered_count ${FROM_EVENTS} WHERE e.id = $1`,
    [id],
  );
  if (!rows[0]) throw AppError.notFound('Event not found.', 'EVENT_NOT_FOUND');
  return toEvent(rows[0]);
}

async function create(data) {
  const { rows } = await db.query(
    `INSERT INTO events (title, description, category, starts_at, location, capacity, banner_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [data.title, data.description, data.category, data.startsAt, data.location, data.capacity, data.bannerUrl],
  );
  return getById(rows[0].id);
}

async function update(id, data) {
  await db.withTransaction(async (client) => {
    // Lock the event row so no registration sneaks in while we check capacity.
    const found = await client.query('SELECT id FROM events WHERE id = $1 FOR UPDATE', [id]);
    if (!found.rows[0]) throw AppError.notFound('Event not found.', 'EVENT_NOT_FOUND');

    const count = await client.query('SELECT COUNT(*)::int AS n FROM registrations WHERE event_id = $1', [id]);
    const registered = count.rows[0].n;
    if (data.capacity < registered) {
      throw AppError.badRequest(
        'CAPACITY_BELOW_REGISTRATIONS',
        `Capacity can't be lower than the ${registered} people already registered.`,
        [{ field: 'capacity', message: `Must be at least ${registered}` }],
      );
    }

    await client.query(
      `UPDATE events SET title = $1, description = $2, category = $3, starts_at = $4,
         location = $5, capacity = $6, banner_url = $7, updated_at = now()
       WHERE id = $8`,
      [data.title, data.description, data.category, data.startsAt, data.location, data.capacity, data.bannerUrl, id],
    );
  });
  return getById(id);
}

async function remove(id) {
  const { rowCount } = await db.query('DELETE FROM events WHERE id = $1', [id]);
  if (rowCount === 0) throw AppError.notFound('Event not found.', 'EVENT_NOT_FOUND');
}

module.exports = { listPublic, listAdmin, getById, create, update, remove, toEvent, likePattern };
