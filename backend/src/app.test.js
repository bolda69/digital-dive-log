const request = require('supertest');
const app = require('./app');

describe('Express Application configuration', () => {
  test('GET /api/health returns ok status', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  test('CORS headers are set in response', async () => {
    const response = await request(app).get('/api/health');
    expect(response.headers['access-control-allow-origin']).toBe('*');
  });

  test('Post to /api/health (or any endpoint) with invalid JSON returns 400 bad request', async () => {
    const response = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"bad_json: 123'); // Sending invalid JSON string
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Malformed JSON' });
  });
});
