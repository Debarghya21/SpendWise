const request = require('supertest');
const { createApp } = require('../src/app');

describe('supplier-service HTTP', () => {
  const app = createApp();

  test('GET /health returns UP', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UP');
  });

  test('POST /api/suppliers rejects invalid payload before touching DB', async () => {
    const res = await request(app).post('/api/suppliers').send({ name: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  test('unknown route returns 404 JSON', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
  });
});
