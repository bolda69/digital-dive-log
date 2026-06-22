const request = require('supertest');
const app = require('./app');
const { initDb, closeDb } = require('./db');

describe('API Routes Adversarial and Validation Robustness Tests', () => {
  beforeAll(async () => {
    await initDb(':memory:');
  });

  afterAll(async () => {
    await closeDb();
  });

  beforeEach(async () => {
    await request(app).post('/api/mock/reset');
  });

  describe('Adversarial Type Checking for Optional Fields', () => {
    test('should reject non-string types for sicht', async () => {
      const response = await request(app)
        .post('/api/dives')
        .send({
          ort: 'Dahab',
          datum: '2026-06-20',
          sicht: { detail: '20m' } // Object
        });
      // EXPECTED: 400 Bad Request (strictly validated)
      // ACTUAL: Currently, this passes validation because routes.js has no check on sicht
      expect(response.status).toBe(400);
    });

    test('should reject non-string types for stroemung', async () => {
      const response = await request(app)
        .post('/api/dives')
        .send({
          ort: 'Dahab',
          datum: '2026-06-20',
          stroemung: true // Boolean
        });
      // EXPECTED: 400 Bad Request
      // ACTUAL: Currently, this passes validation because routes.js has no check on stroemung
      expect(response.status).toBe(400);
    });

    test('should reject non-string types for unterschrift_partner', async () => {
      const response = await request(app)
        .post('/api/dives')
        .send({
          ort: 'Dahab',
          datum: '2026-06-20',
          unterschrift_partner: ['John Doe'] // Array
        });
      // EXPECTED: 400 Bad Request
      // ACTUAL: Currently, this passes validation because routes.js has no check on unterschrift_partner
      expect(response.status).toBe(400);
    });
  });

  describe('Adversarial Checks for Integer Fields', () => {
    test('should reject non-integer float values for tauchgang_nr', async () => {
      const response = await request(app)
        .post('/api/dives')
        .send({
          ort: 'Dahab',
          datum: '2026-06-20',
          tauchgang_nr: 1.5 // Float instead of integer
        });
      // EXPECTED: 400 Bad Request
      // ACTUAL: Passes because typeof 1.5 is 'number'
      expect(response.status).toBe(400);
    });

    test('should reject non-integer float values for dauer_min', async () => {
      const response = await request(app)
        .post('/api/dives')
        .send({
          ort: 'Dahab',
          datum: '2026-06-20',
          dauer_min: 45.8 // Float instead of integer
        });
      // EXPECTED: 400 Bad Request
      // ACTUAL: Passes because typeof 45.8 is 'number'
      expect(response.status).toBe(400);
    });
  });

  describe('Adversarial Checks for Extreme/Special Numeric Values', () => {
    test('should reject Infinity in numeric fields', async () => {
      const response = await request(app)
        .post('/api/dives')
        .send({
          ort: 'Dahab',
          datum: '2026-06-20',
          tiefe_m: Infinity // Infinity
        });
      // EXPECTED: 400 Bad Request
      // ACTUAL: Passes because typeof Infinity is 'number' and it is not NaN or negative
      expect(response.status).toBe(400);
    });

    test('should reject extremely large unreasonable values for numeric fields', async () => {
      const response = await request(app)
        .post('/api/dives')
        .send({
          ort: 'Dahab',
          datum: '2026-06-20',
          tiefe_m: 12000 // 12km deep (deeper than Mariana Trench)
        });
      // EXPECTED: 400 Bad Request (out-of-bounds/unreasonable)
      // ACTUAL: Passes because there are no upper limits
      expect(response.status).toBe(400);
    });
  });

  describe('Adversarial Checks for String Length Limits', () => {
    test('should reject extremely long strings for ort to prevent DOS/Buffer Overflow', async () => {
      const longOrt = 'A'.repeat(5000); // 5000 characters
      const response = await request(app)
        .post('/api/dives')
        .send({
          ort: longOrt,
          datum: '2026-06-20'
        });
      // EXPECTED: 400 Bad Request (exceeds reasonable limit, e.g., 255 or 1000 characters)
      // ACTUAL: Passes because there is no length validation
      expect(response.status).toBe(400);
    });
  });

  describe('Adversarial Request Body Content Validation', () => {
    test('should reject null request body with 400 Bad Request instead of crashing with 500', async () => {
      const response = await request(app)
        .post('/api/dives')
        .set('Content-Type', 'application/json')
        .send('null'); // Sending JSON null
      
      // EXPECTED: 400 Bad Request
      // ACTUAL: Throws TypeError: Cannot destructure property 'ort' of 'req.body' as it is null.
      // Express catches this and returns 500 Internal Server Error.
      expect(response.status).toBe(400);
    });

    test('should reject missing or empty Content-Type request body with 400 Bad Request instead of crashing with 500', async () => {
      const response = await request(app)
        .post('/api/dives')
        .set('Content-Type', 'text/plain')
        .send('ort=Dahab&datum=2026-06-20'); // Sent with text/plain, so body-parser is not run, req.body is undefined.
      
      // EXPECTED: 400 Bad Request (ort/datum missing or invalid format)
      // ACTUAL: Throws TypeError: Cannot destructure property 'ort' of 'req.body' as it is undefined.
      // Express catches this and returns 500 Internal Server Error.
      expect(response.status).toBe(400);
    });
  });
});
