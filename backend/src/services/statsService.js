// Numbers for the admin dashboard.
const db = require('../db/pool');

async function getDashboardStats() {
  const [totals, perEvent, nextEvents] = await Promise.all([
    db.query(`
      SELECT
        (SELECT COUNT(*)::int FROM events) AS total_events,
        (SELECT COUNT(*)::int FROM registrations) AS total_registrations,
        (SELECT COUNT(*)::int FROM events WHERE starts_at >= now()) AS upcoming_events,
        (SELECT COUNT(*)::int FROM events e
           WHERE e.capacity <= (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id)) AS sold_out_events
    `),
    db.query(`
      SELECT e.id, e.title, e.capacity, COUNT(r.id)::int AS registrations
      FROM events e LEFT JOIN registrations r ON r.event_id = e.id
      GROUP BY e.id
      ORDER BY registrations DESC, e.starts_at ASC
      LIMIT 10
    `),
    db.query(`
      SELECT e.id, e.title, e.starts_at, e.capacity, COUNT(r.id)::int AS registrations
      FROM events e LEFT JOIN registrations r ON r.event_id = e.id
      WHERE e.starts_at >= now()
      GROUP BY e.id
      ORDER BY e.starts_at ASC
      LIMIT 5
    `),
  ]);

  const t = totals.rows[0];
  return {
    totalEvents: t.total_events,
    totalRegistrations: t.total_registrations,
    upcomingEvents: t.upcoming_events,
    soldOutEvents: t.sold_out_events,
    perEvent: perEvent.rows.map((r) => ({
      id: r.id,
      title: r.title,
      registrations: r.registrations,
      capacity: r.capacity,
    })),
    nextEvents: nextEvents.rows.map((r) => ({
      id: r.id,
      title: r.title,
      startsAt: new Date(r.starts_at).toISOString(),
      registrations: r.registrations,
      capacity: r.capacity,
    })),
  };
}

module.exports = { getDashboardStats };
