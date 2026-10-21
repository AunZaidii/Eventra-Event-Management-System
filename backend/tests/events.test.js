const {
  app,
  request,
  daysFromNow,
  setupDatabase,
  clearData,
  createEvent,
  addRegistrations,
  closeDatabase,
} = require('./helpers');

beforeAll(setupDatabase);
beforeEach(clearData);
afterAll(closeDatabase);

describe('GET /api/events (public list)', () => {
  test('returns upcoming events only, soonest first, with seat counts', async () => {
    const later = await createEvent({ title: 'Later Event', startsAt: daysFromNow(20), capacity: 5 });
    const soon = await createEvent({ title: 'Soon Event', startsAt: daysFromNow(2), capacity: 5 });
    await createEvent({ title: 'Past Event', startsAt: daysFromNow(-3) });
    await addRegistrations(soon.id, 2);

    const res = await request(app).get('/api/events');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.items.map((e) => e.title)).toEqual(['Soon Event', 'Later Event']);
    expect(res.body.items[0]).toMatchObject({
      id: soon.id,
      capacity: 5,
      registeredCount: 2,
      seatsLeft: 3,
      isSoldOut: false,
      isPast: false,
    });
    expect(res.body.items[1].id).toBe(later.id);
  });

  test('returns an empty list when there are no events', async () => {
    const res = await request(app).get('/api/events');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ items: [], total: 0, page: 1 });
  });

  test('filters by category', async () => {
    await createEvent({ title: 'A Workshop', category: 'Workshop' });
    await createEvent({ title: 'A Concert', category: 'Concert' });
    const res = await request(app).get('/api/events?category=Workshop');
    expect(res.status).toBe(200);
    expect(res.body.items.map((e) => e.title)).toEqual(['A Workshop']);
  });

  test('searches title, location and description (case-insensitive)', async () => {
    await createEvent({ title: 'Cloud Native Summit', location: 'Karachi' });
    await createEvent({ title: 'Music Night', location: 'Lahore' });
    const byTitle = await request(app).get('/api/events?q=cloud');
    expect(byTitle.body.items.map((e) => e.title)).toEqual(['Cloud Native Summit']);
    const byLocation = await request(app).get('/api/events?q=LAHORE');
    expect(byLocation.body.items.map((e) => e.title)).toEqual(['Music Night']);
  });

  test('treats % and _ in search text literally', async () => {
    await createEvent({ title: '100% Fun' });
    await createEvent({ title: 'Other Event' });
    const res = await request(app).get('/api/events?q=%25');
    expect(res.body.items.map((e) => e.title)).toEqual(['100% Fun']);
  });

  test('filters by date range (from / to)', async () => {
    await createEvent({ title: 'In 3 days', startsAt: daysFromNow(3) });
    await createEvent({ title: 'In 30 days', startsAt: daysFromNow(30) });
    const from = daysFromNow(10).slice(0, 10);
    const res = await request(app).get(`/api/events?from=${from}`);
    expect(res.body.items.map((e) => e.title)).toEqual(['In 30 days']);
    const to = daysFromNow(10).slice(0, 10);
    const res2 = await request(app).get(`/api/events?to=${to}`);
    expect(res2.body.items.map((e) => e.title)).toEqual(['In 3 days']);
  });

  test('ignores empty filter values', async () => {
    await createEvent();
    const res = await request(app).get('/api/events?q=&category=&from=');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
  });

  test('sorts by most seats left', async () => {
    const small = await createEvent({ title: 'Small', capacity: 5, startsAt: daysFromNow(1) });
    await createEvent({ title: 'Big', capacity: 100, startsAt: daysFromNow(5) });
    await addRegistrations(small.id, 1);
    const res = await request(app).get('/api/events?sort=seats');
    expect(res.body.items.map((e) => e.title)).toEqual(['Big', 'Small']);
  });

  test('paginates with page and limit', async () => {
    for (let i = 1; i <= 5; i += 1) await createEvent({ title: `Event ${i}`, startsAt: daysFromNow(i) });
    const res = await request(app).get('/api/events?limit=2&page=2');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 2, limit: 2, total: 5 });
    expect(res.body.items.map((e) => e.title)).toEqual(['Event 3', 'Event 4']);
  });

  test('rejects invalid filters with 400 VALIDATION_ERROR', async () => {
    for (const query of ['category=Nope', 'from=21-10-2026', 'limit=500', 'page=0', 'sort=random']) {
      const res = await request(app).get(`/api/events?${query}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  test('marks a full event as sold out', async () => {
    const full = await createEvent({ capacity: 2 });
    await addRegistrations(full.id, 2);
    const res = await request(app).get('/api/events');
    expect(res.body.items[0]).toMatchObject({ seatsLeft: 0, isSoldOut: true });
  });
});

describe('GET /api/events/:id', () => {
  test('returns one event with all public fields', async () => {
    const ev = await createEvent({ title: 'Detail Event', bannerUrl: 'https://example.com/a.jpg' });
    const res = await request(app).get(`/api/events/${ev.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: ev.id,
      title: 'Detail Event',
      category: 'Conference',
      location: 'Test Hall',
      capacity: 10,
      bannerUrl: 'https://example.com/a.jpg',
      seatsLeft: 10,
    });
    expect(res.body.description).toBeTruthy();
    expect(res.body.startsAt).toMatch(/Z$/);
  });

  test('returns 404 EVENT_NOT_FOUND for a missing event', async () => {
    const res = await request(app).get('/api/events/99999');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('EVENT_NOT_FOUND');
  });

  test('returns 400 for a non-numeric id', async () => {
    const res = await request(app).get('/api/events/abc');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/categories', () => {
  test('returns the fixed category list', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual(['Conference', 'Workshop', 'Meetup', 'Concert', 'Sports', 'Webinar', 'Other']);
  });
});
