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
  closeDatabase,
} = require('./helpers');
const { CODE_PATTERN } = require('../src/utils/registrationCode');

beforeAll(setupDatabase);
beforeEach(clearData);
afterAll(closeDatabase);

describe('POST /api/events/:id/registrations', () => {
  test('registers a visitor and returns a unique code', async () => {
    const ev = await createEvent({ capacity: 5 });
    const res = await register(ev.id, validPerson({ email: '  Sara@Example.COM ' }));

    expect(res.status).toBe(201);
    expect(res.body.code).toMatch(CODE_PATTERN);
    expect(res.body.registration).toMatchObject({
      eventId: ev.id,
      name: 'Sara Ahmed',
      email: 'sara@example.com', // trimmed and lower-cased
      phone: '+92 300 1234567',
      code: res.body.code,
    });
    expect(res.body.event).toMatchObject({ id: ev.id, registeredCount: 1, seatsLeft: 4 });

    const { rows } = await db.query('SELECT COUNT(*)::int AS n FROM registrations WHERE event_id = $1', [ev.id]);
    expect(rows[0].n).toBe(1);
  });

  test('gives every registration a different code', async () => {
    const ev = await createEvent({ capacity: 20 });
    const codes = new Set();
    for (let i = 0; i < 10; i += 1) {
      const res = await register(ev.id, validPerson({ email: `p${i}@example.com` }));
      expect(res.status).toBe(201);
      codes.add(res.body.code);
    }
    expect(codes.size).toBe(10);
  });

  test('rejects a duplicate email for the same event with 409', async () => {
    const ev = await createEvent();
    expect((await register(ev.id, validPerson())).status).toBe(201);

    const res = await register(ev.id, validPerson({ name: 'Someone Else' }));
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: 'DUPLICATE_REGISTRATION',
      message: 'This email is already registered for this event.',
    });
  });

  test('treats emails with different letter case as duplicates', async () => {
    const ev = await createEvent();
    await register(ev.id, validPerson({ email: 'sara@example.com' }));
    const res = await register(ev.id, validPerson({ email: 'SARA@EXAMPLE.COM' }));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_REGISTRATION');
  });

  test('allows the same email to register for a different event', async () => {
    const a = await createEvent({ title: 'A' });
    const b = await createEvent({ title: 'B' });
    expect((await register(a.id, validPerson())).status).toBe(201);
    expect((await register(b.id, validPerson())).status).toBe(201);
  });

  test('rejects registration when the event is full with 409 EVENT_FULL', async () => {
    const ev = await createEvent({ capacity: 2 });
    await addRegistrations(ev.id, 2);

    const res = await register(ev.id, validPerson());
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'EVENT_FULL', message: 'Sorry, this event is sold out.' });

    const detail = await request(app).get(`/api/events/${ev.id}`);
    expect(detail.body).toMatchObject({ seatsLeft: 0, isSoldOut: true });
  });

  test('the last seat can be taken, then the event becomes sold out', async () => {
    const ev = await createEvent({ capacity: 1 });
    expect((await register(ev.id, validPerson({ email: 'first@example.com' }))).status).toBe(201);
    const second = await register(ev.id, validPerson({ email: 'second@example.com' }));
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('EVENT_FULL');
  });

  test('never overbooks when many people register at the same moment', async () => {
    const ev = await createEvent({ capacity: 3 });
    const attempts = Array.from({ length: 10 }, (_, i) => register(ev.id, validPerson({ email: `rush${i}@example.com` })));
    const results = await Promise.all(attempts);

    const created = results.filter((r) => r.status === 201);
    const full = results.filter((r) => r.status === 409 && r.body.error.code === 'EVENT_FULL');
    expect(created).toHaveLength(3);
    expect(full).toHaveLength(7);

    const { rows } = await db.query('SELECT COUNT(*)::int AS n FROM registrations WHERE event_id = $1', [ev.id]);
    expect(rows[0].n).toBe(3);
  });

  test('never creates duplicates when the same email is sent twice at once', async () => {
    const ev = await createEvent({ capacity: 10 });
    const results = await Promise.all([register(ev.id, validPerson()), register(ev.id, validPerson())]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  });

  test('rejects invalid input with 400 and per-field messages', async () => {
    const ev = await createEvent();
    const res = await register(ev.id, { name: 'A', email: 'not-an-email', phone: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const fields = res.body.error.details.map((d) => d.field).sort();
    expect(fields).toEqual(['email', 'name', 'phone']);
  });

  test('rejects missing fields with 400', async () => {
    const ev = await createEvent();
    const res = await register(ev.id, {});
    expect(res.status).toBe(400);
    expect(res.body.error.details).toHaveLength(3);
  });

  test('returns 404 for an event that does not exist', async () => {
    const res = await register(99999, validPerson());
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('EVENT_NOT_FOUND');
  });

  test('rejects registration for an event that already happened', async () => {
    const ev = await createEvent({ startsAt: daysFromNow(-1) });
    const res = await register(ev.id, validPerson());
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('EVENT_PAST');
  });

  test('ignores unknown extra fields (cannot set the code yourself)', async () => {
    const ev = await createEvent();
    const res = await register(ev.id, { ...validPerson(), code: 'EVT-HACKED', eventId: 12345 });
    expect(res.status).toBe(201);
    expect(res.body.code).not.toBe('EVT-HACKED');
    expect(res.body.registration.eventId).toBe(ev.id);
  });
});
