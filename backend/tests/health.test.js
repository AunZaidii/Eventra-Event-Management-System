const { app, request, db, setupDatabase, closeDatabase } = require('./helpers');

beforeAll(setupDatabase);
afterAll(closeDatabase);
afterEach(() => jest.restoreAllMocks());

describe('GET /api/health', () => {
  test('returns 200 with status ok when the database is up', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'up' });
    expect(typeof res.body.uptime).toBe('number');
    expect(new Date(res.body.timestamp).toString()).not.toBe('Invalid Date');
  });

  test('returns 503 with db down when the database query fails', async () => {
    jest.spyOn(db, 'query').mockRejectedValueOnce(new Error('connection refused'));
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'error', db: 'down' });
  });

  test('is not affected by the general API rate limiter headers', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers).not.toHaveProperty('ratelimit');
  });
});

describe('general API behaviour', () => {
  test('unknown routes return 404 in the standard error shape', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({ code: 'ROUTE_NOT_FOUND' });
  });

  test('invalid JSON bodies return 400 INVALID_JSON', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  test('security headers from helmet are present', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['content-security-policy']).toBeDefined();
  });
});
