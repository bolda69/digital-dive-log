const request = require('supertest');
const app = require('./app');

describe('Adversarial Express Configuration Tests', () => {
  // 1. Malformed JSON in request bodies
  describe('Malformed JSON Handling', () => {
    test('Should return 400 Bad Request with Malformed JSON error on invalid syntax', async () => {
      const response = await request(app)
        .post('/api/health')
        .set('Content-Type', 'application/json')
        .send('{"key": "value", }'); // Trailing comma/invalid JSON
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Malformed JSON' });
    });

    test('Should handle unicode escape error in JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/health')
        .set('Content-Type', 'application/json')
        .send('{"key": "\\u00G1"}'); // Invalid unicode escape sequence
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Malformed JSON' });
    });

    test('Should not trigger malformed JSON error when sending empty body with JSON Content-Type', async () => {
      const response = await request(app)
        .post('/api/health')
        .set('Content-Type', 'application/json')
        .send(''); // Empty body
      // Express body-parser returns empty object {} for empty body, which is valid, not a syntax error
      expect(response.status).toBe(200); // Because it falls through or succeeds
    });

    test('Should ignore malformed JSON when Content-Type is not application/json', async () => {
      const response = await request(app)
        .post('/api/health')
        .set('Content-Type', 'text/plain')
        .send('{"key": "value", }');
      // body-parser for json doesn't parse text/plain, so no error is thrown
      expect(response.status).toBe(200);
    });
  });

  // 2. Body Payload Limits (413 Payload Too Large)
  describe('Express Body Limits', () => {
    test('Should return 413 Payload Too Large when payload exceeds Express json limit', async () => {
      // Default limit is 100kb. Let's send a payload > 100kb (e.g. 150kb of whitespace/data)
      const largeData = 'a'.repeat(150 * 1024);
      const payload = JSON.stringify({ data: largeData });

      const response = await request(app)
        .post('/api/health')
        .set('Content-Type', 'application/json')
        .send(payload);

      // Verify that it limits large request bodies
      expect(response.status).toBe(413);
    });
  });

  // 3. CORS Preflight & Headers
  describe('CORS Configuration', () => {
    test('OPTIONS preflight request should respond with appropriate headers', async () => {
      const response = await request(app)
        .options('/api/health')
        .set('Origin', 'http://example.com')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type');
      
      expect(response.status).toBe(204); // CORS package returns 204 No Content for OPTIONS
      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(response.headers['access-control-allow-methods']).toContain('GET,HEAD,PUT,PATCH,POST,DELETE');
    });
  });
});
