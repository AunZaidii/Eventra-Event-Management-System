const jwt = require('jsonwebtoken');
const {
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
} = require('./helpers');

let token;
const auth = () => ({ Authorization: `Bearer ${token}` });

const eventBody = (overrides = {}) => ({
  title: 'New Admin Event',
  description: 'Created by the admin during tests.',
  category: 'Workshop',
  startsAt: daysFromNow(14),
  location: 'Lab 2',
  capacity: 25,
  bannerUrl: 'https://example.com/banner.jpg',
  ...overrides,
});

beforeAll(async () => {
  await setupDatabase();
  token = await adminToken();
});
beforeEach(clearData);
afterAll(closeDatabase);

describe('POST /api/auth/login', () => {
  test('returns a JWT for the seeded admin (email is case-insensitive)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: process.env.ADMIN_EMAIL.toUpperCase(), password: process.env.ADMIN_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.admin.email).toBe(process.env.ADMIN_EMAIL);
    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(payload.role).toBe('admin');
    expect(new Date(res.body.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  test('rejects a wrong password with 401', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: process.env.ADMIN_EMAIL, password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('rejects an unknown email with the same 401 message', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'whatever' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Email or password is incorrect.');
  });

  test('rejects an invalid body with 400', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'bad' });
    expect(res.status).toBe(400);
  });

  test('stores the admin password as a bcrypt hash, never as plain text', async () => {
    const { rows } = await db.query('SELECT password_hash FROM admins WHERE email = $1', [process.env.ADMIN_EMAIL]);
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$12\$/);
    expect(rows[0].password_hash).not.toContain(process.env.ADMIN_PASSWORD);
  });
});

describe('admin route protection', () => {
  const routes = [
    ['get', '/api/admin/stats'],
    ['get', '/api/admin/events'],
    ['post', '/api/admin/events'],
    ['put', '/api/admin/events/1'],
    ['delete', '/api/admin/events/1'],
    ['get', '/api/admin/events/1/registrations'],
    ['get', '/api/admin/events/1/registrations/export'],
    ['get', '/api/auth/me'],
  ];

  test.each(routes)('%s %s without a token returns 401', async (method, url) => {
    const res = await request(app)[method](url);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('a token signed with the wrong secret is rejected', async () => {
    const fake = jwt.sign({ sub: '1', role: 'admin' }, 'x'.repeat(40));
    const res = await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${fake}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  test('an expired token is rejected with TOKEN_EXPIRED', async () => {
    const old = jwt.sign({ sub: '1', role: 'admin', exp: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_SECRET);
    const res = await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${old}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  test('GET /api/auth/me returns the signed-in admin', async () => {
    const res = await request(app).get('/api/auth/me').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.admin.email).toBe(process.env.ADMIN_EMAIL);
  });
});

describe('GET /api/admin/stats', () => {
  test('returns totals and registrations per event', async () => {
    const a = await createEvent({ title: 'Busy', capacity: 2 });
    const b = await createEvent({ title: 'Quiet', capacity: 50 });
    await createEvent({ title: 'Old', startsAt: daysFromNow(-5) });
    await addRegistrations(a.id, 2);
    await addRegistrations(b.id, 1);

    const res = await request(app).get('/api/admin/stats').set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ totalEvents: 3, totalRegistrations: 3, upcomingEvents: 2, soldOutEvents: 1 });
    expect(res.body.perEvent[0]).toMatchObject({ title: 'Busy', registrations: 2, capacity: 2 });
    expect(res.body.nextEvents.map((e) => e.title)).not.toContain('Old');
  });
});

describe('event management (create / edit / delete)', () => {
  test('creates an event that then appears on the public list', async () => {
    const res = await request(app).post('/api/admin/events').set(auth()).send(eventBody());
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: 'New Admin Event', capacity: 25, seatsLeft: 25, bannerUrl: 'https://example.com/banner.jpg' });

    const pub = await request(app).get('/api/events');
    expect(pub.body.items.map((e) => e.id)).toContain(res.body.id);
  });

  test('banner URL is optional (empty string becomes null)', async () => {
    const res = await request(app).post('/api/admin/events').set(auth()).send(eventBody({ bannerUrl: '' }));
    expect(res.status).toBe(201);
    expect(res.body.bannerUrl).toBeNull();
  });

  test.each([
    ['a past date', { startsAt: daysFromNow(-1) }, 'startsAt'],
    ['an invalid date', { startsAt: 'next friday' }, 'startsAt'],
    ['an unknown category', { category: 'Party' }, 'category'],
    ['zero capacity', { capacity: 0 }, 'capacity'],
    ['a fractional capacity', { capacity: 2.5 }, 'capacity'],
    ['a short title', { title: 'Hi' }, 'title'],
    ['a non-http banner URL', { bannerUrl: 'javascript:alert(1)' }, 'bannerUrl'],
  ])('rejects %s with 400', async (_label, override, field) => {
    const res = await request(app).post('/api/admin/events').set(auth()).send(eventBody(override));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.field)).toContain(field);
  });

  test('updates an event', async () => {
    const ev = await createEvent();
    const res = await request(app)
      .put(`/api/admin/events/${ev.id}`)
      .set(auth())
      .send(eventBody({ title: 'Renamed Event', capacity: 40 }));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: ev.id, title: 'Renamed Event', capacity: 40 });
  });

  test('does not allow capacity below the current number of registrations', async () => {
    const ev = await createEvent({ capacity: 10 });
    await addRegistrations(ev.id, 4);
    const res = await request(app).put(`/api/admin/events/${ev.id}`).set(auth()).send(eventBody({ capacity: 3 }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CAPACITY_BELOW_REGISTRATIONS');

    const ok = await request(app).put(`/api/admin/events/${ev.id}`).set(auth()).send(eventBody({ capacity: 4 }));
    expect(ok.status).toBe(200);
    expect(ok.body.isSoldOut).toBe(true);
  });

  test('update of a missing event returns 404', async () => {
    const res = await request(app).put('/api/admin/events/99999').set(auth()).send(eventBody());
    expect(res.status).toBe(404);
  });

  test('deletes an event together with its registrations', async () => {
    const ev = await createEvent();
    await addRegistrations(ev.id, 3);
    const res = await request(app).delete(`/api/admin/events/${ev.id}`).set(auth());
    expect(res.status).toBe(204);

    const { rows } = await db.query('SELECT COUNT(*)::int AS n FROM registrations WHERE event_id = $1', [ev.id]);
    expect(rows[0].n).toBe(0);
    expect((await request(app).get(`/api/events/${ev.id}`)).status).toBe(404);
  });

  test('deleting a missing event returns 404', async () => {
    const res = await request(app).delete('/api/admin/events/99999').set(auth());
    expect(res.status).toBe(404);
  });

  test('admin list includes past events and filters by status', async () => {
    await createEvent({ title: 'Upcoming One' });
    await createEvent({ title: 'Past One', startsAt: daysFromNow(-2) });
    const full = await createEvent({ title: 'Full One', capacity: 1 });
    await addRegistrations(full.id, 1);

    const all = await request(app).get('/api/admin/events').set(auth());
    expect(all.body.total).toBe(3);
    const past = await request(app).get('/api/admin/events?status=past').set(auth());
    expect(past.body.items.map((e) => e.title)).toEqual(['Past One']);
    const soldOut = await request(app).get('/api/admin/events?status=soldout').set(auth());
    expect(soldOut.body.items.map((e) => e.title)).toEqual(['Full One']);
  });
});

describe('registrations list and CSV export', () => {
  test('lists registrations for an event, newest first, with search', async () => {
    const ev = await createEvent();
    await register(ev.id, validPerson({ name: 'Ali Raza', email: 'ali@example.com' }));
    await register(ev.id, validPerson({ name: 'Zara Khan', email: 'zara@example.com' }));

    const res = await request(app).get(`/api/admin/events/${ev.id}/registrations`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.items[0].name).toBe('Zara Khan');

    const search = await request(app).get(`/api/admin/events/${ev.id}/registrations?q=ali`).set(auth());
    expect(search.body.items.map((r) => r.name)).toEqual(['Ali Raza']);
  });

  test('exports registrations as a CSV download', async () => {
    const ev = await createEvent({ title: 'Cloud Native Summit 2026' });
    const reg = await register(ev.id, validPerson({ name: 'Sara "S" Ahmed' }));

    const res = await request(app).get(`/api/admin/events/${ev.id}/registrations/export`).set(auth());
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/csv/);
    expect(res.headers['content-disposition']).toBe('attachment; filename="cloud-native-summit-2026-registrations.csv"');

    const lines = res.text.replace(/^﻿/, '').trim().split('\r\n');
    expect(lines[0]).toBe('"Name","Email","Phone","Registration code","Registered at (UTC)"');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('"Sara ""S"" Ahmed"');
    expect(lines[1]).toContain(`"${reg.body.code}"`);
  });

  test('CSV export of an event with no registrations has only the header row', async () => {
    const ev = await createEvent();
    const res = await request(app).get(`/api/admin/events/${ev.id}/registrations/export`).set(auth());
    expect(res.status).toBe(200);
    expect(res.text.replace(/^﻿/, '').trim().split('\r\n')).toHaveLength(1);
  });

  test('registrations of a missing event return 404', async () => {
    const res = await request(app).get('/api/admin/events/99999/registrations').set(auth());
    expect(res.status).toBe(404);
  });
});
