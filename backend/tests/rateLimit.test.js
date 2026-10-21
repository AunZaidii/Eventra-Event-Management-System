// Uses low limits (set before the app loads) to check that throttling kicks in.
process.env.RATE_LIMIT_LOGIN_MAX = '3';
process.env.RATE_LIMIT_REGISTER_MAX = '2';

const { app, request, setupDatabase, clearData, createEvent, register, validPerson, closeDatabase } = require('./helpers');

beforeAll(setupDatabase);
beforeEach(clearData);
afterAll(closeDatabase);

test('login is blocked with 429 after too many attempts', async () => {
  const attempt = () => request(app).post('/api/auth/login').send({ email: 'x@example.com', password: 'nope' });
  for (let i = 0; i < 3; i += 1) expect((await attempt()).status).toBe(401);

  const blocked = await attempt();
  expect(blocked.status).toBe(429);
  expect(blocked.body.error.code).toBe('RATE_LIMITED');
});

test('registration is blocked with 429 after too many attempts', async () => {
  const ev = await createEvent({ capacity: 50 });
  expect((await register(ev.id, validPerson({ email: 'a@example.com' }))).status).toBe(201);
  expect((await register(ev.id, validPerson({ email: 'b@example.com' }))).status).toBe(201);

  const blocked = await register(ev.id, validPerson({ email: 'c@example.com' }));
  expect(blocked.status).toBe(429);
  expect(blocked.body.error.code).toBe('RATE_LIMITED');
});

test('the health check is never rate limited', async () => {
  for (let i = 0; i < 10; i += 1) {
    expect((await request(app).get('/api/health')).status).toBe(200);
  }
});
