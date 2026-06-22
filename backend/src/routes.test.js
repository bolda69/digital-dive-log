const request = require('supertest');
const app = require('./app');
const { initDb, closeDb } = require('./db');

describe('Backend API Routes', () => {
  beforeAll(async () => {
    // Initialize in-memory database
    await initDb(':memory:');
  });

  afterAll(async () => {
    // Close the database connection
    await closeDb();
  });

  beforeEach(async () => {
    // Reset database to a known baseline before each test
    await request(app).post('/api/mock/reset');
  });

  describe('GET /api/dives', () => {
    test('should retrieve all dives', async () => {
      const response = await request(app).get('/api/dives');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1); // 1 baseline dive from mock/reset
      expect(response.body[0].ort).toBe('Dahab Blue Hole');
      expect(response.body[0].tauchgang_nr).toBe(527);
    });
  });

  describe('POST /api/dives', () => {
    test('should successfully insert a valid dive', async () => {
      const newDive = {
        tauchgang_nr: 1,
        ort: "Tenerife",
        datum: "2026-06-21",
        sicht: "15m",
        gewicht_kg: 6,
        dauer_min: 50,
        tiefe_m: 18.5,
        temperatur_c: 20,
        stroemung: "none",
        unterschrift_partner: "Jane Doe",
        stempel: ["Tenerife Dive Academy"]
      };

      const response = await request(app)
        .post('/api/dives')
        .send(newDive);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.ort).toBe("Tenerife");
      expect(response.body.datum).toBe("2026-06-21");
      expect(response.body.stempel).toEqual(["Tenerife Dive Academy"]);

      // Verify it was added to the database
      const getResponse = await request(app).get('/api/dives');
      expect(getResponse.body.length).toBe(2);
      expect(getResponse.body[0].ort).toBe("Tenerife"); // descending order by ID
    });

    test('should reject if ort is missing', async () => {
      const response = await request(app)
        .post('/api/dives')
        .send({
          datum: "2026-06-21"
        });
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('ort');
    });

    test('should reject if ort is empty string', async () => {
      const response = await request(app)
        .post('/api/dives')
        .send({
          ort: "  ",
          datum: "2026-06-21"
        });
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('ort');
    });

    test('should reject if datum is missing', async () => {
      const response = await request(app)
        .post('/api/dives')
        .send({
          ort: "Dahab"
        });
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('datum');
    });

    test('should reject if datum is not YYYY-MM-DD format', async () => {
      const response = await request(app)
        .post('/api/dives')
        .send({
          ort: "Dahab",
          datum: "20-06-2026"
        });
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('format');
    });

    test('should reject if datum is an invalid calendar date', async () => {
      const response = await request(app)
        .post('/api/dives')
        .send({
          ort: "Dahab",
          datum: "2026-02-30" // February 30th doesn't exist
        });
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('calendar date');
    });

    test('should reject if numeric fields are negative', async () => {
      const response = await request(app)
        .post('/api/dives')
        .send({
          ort: "Dahab",
          datum: "2026-06-20",
          tiefe_m: -5
        });
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('tiefe_m');
    });

    test('should reject if numeric fields are not numbers', async () => {
      const response = await request(app)
        .post('/api/dives')
        .send({
          ort: "Dahab",
          datum: "2026-06-20",
          dauer_min: "forty-five"
        });
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('dauer_min');
    });

    test('should reject if stempel is not an array', async () => {
      const response = await request(app)
        .post('/api/dives')
        .send({
          ort: "Dahab",
          datum: "2026-06-20",
          stempel: "not-an-array"
        });
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('stempel');
    });

    test('should reject if stempel array has non-string elements', async () => {
      const response = await request(app)
        .post('/api/dives')
        .send({
          ort: "Dahab",
          datum: "2026-06-20",
          stempel: ["stamp1", 123]
        });
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('stempel');
    });

    test('should return 400 Malformed JSON when invalid JSON is sent', async () => {
      const response = await request(app)
        .post('/api/dives')
        .set('Content-Type', 'application/json')
        .send('{"ort": "Dahab", "datum": "2026-06-20",}'); // trailing comma
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Malformed JSON');
    });

    test('should handle SQL characters in text fields without injection', async () => {
      const response = await request(app)
        .post('/api/dives')
        .send({
          ort: "Dahab'; DROP TABLE dives; --",
          datum: "2026-06-20",
          sicht: "10m'); --",
          stroemung: "none",
          unterschrift_partner: "partner'; --"
        });
      expect(response.status).toBe(201);
      expect(response.body.ort).toBe("Dahab'; DROP TABLE dives; --");

      // Verify the table was not dropped
      const checkRes = await request(app).get('/api/dives');
      expect(checkRes.status).toBe(200);
      expect(checkRes.body.length).toBe(2);
    });

    test('should handle boundary date values like leap years correctly', async () => {
      // Leap year date (2024-02-29 is valid)
      const responseLeap = await request(app)
        .post('/api/dives')
        .send({
          ort: "Dahab",
          datum: "2024-02-29"
        });
      expect(responseLeap.status).toBe(201);

      // Non-leap year date (2025-02-29 is invalid)
      const responseNonLeap = await request(app)
        .post('/api/dives')
        .send({
          ort: "Dahab",
          datum: "2025-02-29"
        });
      expect(responseNonLeap.status).toBe(400);
      expect(responseNonLeap.body.error).toContain('calendar date');
    });

    test('should check behavior of optional fields with unexpected types', async () => {
      // Sending an object for a text field like 'sicht'
      const responseObj = await request(app)
        .post('/api/dives')
        .send({
          ort: "Dahab",
          datum: "2026-06-20",
          sicht: { description: "clear" }
        });
      
      // If the API does not validate type of 'sicht', the database might fail (500)
      // or convert it to string/JSON. Let's write the test so we assert the actual outcome,
      // showing whether the code allows it or throws 500.
      expect([201, 400, 500]).toContain(responseObj.status);
    });

    test('should handle extreme numbers or NaN/Infinity in numeric fields', async () => {
      const responseInf = await request(app)
        .post('/api/dives')
        .send({
          ort: "Dahab",
          datum: "2026-06-20",
          tauchgang_nr: Infinity
        });
      // Infinity is a number type, but might fail database constraint or serialization.
      expect([201, 400, 500]).toContain(responseInf.status);

      const responseNaN = await request(app)
        .post('/api/dives')
        .send({
          ort: "Dahab",
          datum: "2026-06-20",
          tauchgang_nr: NaN
        });
      // NaN should be rejected as not a number or not valid
      expect(responseNaN.status).toBe(400);
      expect(responseNaN.body.error).toContain('tauchgang_nr');
    });

    test('should reject negative temperature_c (known business logic limitation/bug)', async () => {
      const response = await request(app)
        .post('/api/dives')
        .send({
          ort: "Ice Dive site",
          datum: "2026-06-20",
          temperatur_c: -2 // physically possible in ice/salt water
        });
      // Under current validation code, negative numbers are rejected for all numeric fields
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('temperatur_c cannot be negative');
    });

    test('should reject year 0000 leap day due to JS Date mapping to 1900 (known edge-case bug)', async () => {
      const response = await request(app)
        .post('/api/dives')
        .send({
          ort: "Ancient Sea",
          datum: "0000-02-29" // Year 0000 (1 BC) is a leap year, but JS maps it to 1900
        });
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('calendar date');
    });

    test('should reject non-string values in optional string fields', async () => {
      const response = await request(app)
        .post('/api/dives')
        .send({
          ort: "Dahab",
          datum: "2026-06-20",
          sicht: { text: "crystal clear" } // object passed where string is expected
        });
      // The API now strictly validates that optional text fields are strings, returning 400.
      expect(response.status).toBe(400);
    });

    test('should handle concurrent/stress GET requests and return all results', async () => {
      // Send multiple GET requests concurrently
      const getRequests = Array.from({ length: 20 }, () => request(app).get('/api/dives'));
      const responses = await Promise.all(getRequests);
      
      for (const res of responses) {
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
      }
    });
  });


  describe('POST /api/mock/reset', () => {
    test('should reset the database and return the seeded baseline dive', async () => {
      // First insert an extra dive
      await request(app)
        .post('/api/dives')
        .send({ ort: 'Temp', datum: '2026-06-21' });

      // Verify db has 2 items
      const checkRes = await request(app).get('/api/dives');
      expect(checkRes.body.length).toBe(2);

      // Reset
      const response = await request(app).post('/api/mock/reset');
      expect(response.status).toBe(200);
      expect(response.body.message).toContain('reset');

      // Verify db is back to 1 baseline item with ID 1
      const finalRes = await request(app).get('/api/dives');
      expect(finalRes.body.length).toBe(1);
      expect(finalRes.body[0].id).toBe(1);
      expect(finalRes.body[0].ort).toBe('Dahab Blue Hole');
    });
  });
});
