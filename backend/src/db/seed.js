// Seeds the admin user (from env) and sample events (only when the events table is empty).
// Run manually with "npm run seed".
const bcrypt = require('bcryptjs');
const config = require('../config');
const db = require('./pool');
const { generateRegistrationCode } = require('../utils/registrationCode');

const BCRYPT_COST = 12;

// Creates the admin, or updates its password if ADMIN_PASSWORD changed.
async function seedAdmin({ log = console.log } = {}) {
  const { email, password } = config.admin;
  if (!email || !password) {
    log('ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin seed');
    return null;
  }
  const hash = await bcrypt.hash(password, BCRYPT_COST);
  const { rows } = await db.query(
    `INSERT INTO admins (email, password_hash) VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id, email`,
    [email, hash],
  );
  log(`Admin account ready: ${rows[0].email}`);
  return rows[0];
}

// A date `days` from now at the given UTC hour.
function daysFromNow(days, hourUtc) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hourUtc, 0, 0, 0);
  return d.toISOString();
}

const img = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=80`;

const SAMPLE_EVENTS = [
  {
    title: 'Cloud Native Summit 2026',
    description: 'A full day of talks and live demos on containers, Kubernetes, CI/CD and running apps at scale on the cloud. Meet engineers who run production systems and join hands-on sessions.',
    category: 'Conference', days: 24, hour: 4, location: 'Expo Centre, Karachi', capacity: 300,
    banner: img('photo-1540575467063-178a50c2df87'),
  },
  {
    title: 'Hands-on React + Vite Workshop',
    description: 'Build and ship a modern React app from scratch with Vite and Tailwind CSS. Bring a laptop with Node.js installed — we will code together step by step.',
    category: 'Workshop', days: 30, hour: 9, location: 'Innovation Lab, Lahore', capacity: 40,
    banner: img('photo-1498050108023-c5249f4df085'),
  },
  {
    title: 'Startup Founders Meetup',
    description: 'An evening of short founder stories, open networking and honest Q&A about building products, raising funds and hiring your first team.',
    category: 'Meetup', days: 32, hour: 13, location: 'The Hive, Islamabad', capacity: 80,
    banner: img('photo-1515187029135-18ee286d815b'),
  },
  {
    title: 'Indie Night Live',
    description: 'Live sets from independent bands across the country. Food stalls, merch and a night of great music under the stars.',
    category: 'Concert', days: 45, hour: 15, location: 'Arts Council, Karachi', capacity: 500,
    banner: img('photo-1501281668745-f7f57925c3b4'),
  },
  {
    title: 'Inter-University Cricket Cup',
    description: 'Teams from eight universities compete in a one-day T20 tournament. Come support your campus — entry is free, seats are limited.',
    category: 'Sports', days: 52, hour: 5, location: 'City Sports Complex', capacity: 400,
    banner: img('photo-1531415074968-036ba1b575da'),
  },
  {
    title: 'AI in Healthcare',
    description: 'An online panel with doctors and engineers on how machine learning is used in diagnosis today, what works, what does not, and what is next.',
    category: 'Webinar', days: 58, hour: 14, location: 'Online', capacity: 1000,
    banner: img('photo-1576091160399-112ba8d25d1d'),
  },
  {
    title: 'Design Systems Masterclass',
    description: 'A small, focused class on building a design system: tokens, components, documentation and getting a whole team to use it.',
    category: 'Workshop', days: 12, hour: 10, location: 'Studio 9, Lahore', capacity: 3,
    banner: img('photo-1522202176988-66273c2fd55f'),
    sampleRegistrations: [
      ['Sara Ahmed', 'sara@example.com', '+92 300 1234567'],
      ['Bilal Khan', 'bilal@example.com', '+92 321 5550199'],
      ['Ayesha Raza', 'ayesha@example.com', '+92 333 7781203'],
    ],
  },
  {
    title: 'Community Open Day',
    description: 'Meet the clubs and societies on campus, try short taster sessions, and find a community that fits you. Everyone is welcome.',
    category: 'Other', days: 18, hour: 6, location: 'Main Campus Lawn', capacity: 250,
    banner: img('photo-1492684223066-81342ee5ff30'),
  },
];

async function seedSampleEvents({ log = console.log } = {}) {
  const { rows } = await db.query('SELECT COUNT(*)::int AS count FROM events');
  if (rows[0].count > 0) {
    log('Events already exist — skipping sample events');
    return 0;
  }

  await db.withTransaction(async (client) => {
    for (const e of SAMPLE_EVENTS) {
      const inserted = await client.query(
        `INSERT INTO events (title, description, category, starts_at, location, capacity, banner_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [e.title, e.description, e.category, daysFromNow(e.days, e.hour), e.location, e.capacity, e.banner],
      );
      for (const [name, email, phone] of e.sampleRegistrations || []) {
        await client.query(
          'INSERT INTO registrations (event_id, name, email, phone, code) VALUES ($1, $2, $3, $4, $5)',
          [inserted.rows[0].id, name, email, phone, generateRegistrationCode()],
        );
      }
    }
  });
  log(`Inserted ${SAMPLE_EVENTS.length} sample events`);
  return SAMPLE_EVENTS.length;
}

module.exports = { seedAdmin, seedSampleEvents, SAMPLE_EVENTS };

// Allow "npm run seed"
if (require.main === module) {
  const { runMigrations } = require('./migrate');
  (async () => {
    await runMigrations();
    await seedAdmin();
    await seedSampleEvents();
    await db.pool.end();
  })().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
