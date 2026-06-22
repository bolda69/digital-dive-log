const request = require('supertest');
const app = require('./app');
const { extractDiveLog } = require('./gemini');

jest.mock('./gemini');

describe('POST /api/upload', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalApiKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    // By default, set environment to production with API key to test the real Gemini code path
    process.env.NODE_ENV = 'production';
    process.env.GEMINI_API_KEY = 'mocked-gemini-api-key';
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.GEMINI_API_KEY = originalApiKey;
  });

  describe('Real Gemini Integration Code Path', () => {
    test('should successfully upload an image and return extracted/sanitized JSON', async () => {
      const mockResult = {
        tauchgang_nr: 101,
        ort: "Gili Trawangan",
        datum: "2026-06-22",
        sicht: "25m",
        gewicht_kg: 7.5,
        dauer_min: 45,
        tiefe_m: 22.3,
        temperatur_c: 29,
        stroemung: "mild",
        unterschrift_partner: "Jane Doe",
        stempel: ["Gili Divers", "2026-06-22"]
      };

      extractDiveLog.mockResolvedValue(mockResult);

      const buffer = Buffer.from('fake image content');
      const response = await request(app)
        .post('/api/upload')
        .attach('image', buffer, { filename: 'dive.png', contentType: 'image/png' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResult);
      expect(extractDiveLog).toHaveBeenCalledTimes(1);
    });

    test('should validate and sanitize coerced optional numeric and text fields correctly', async () => {
      const weirdMockResult = {
        tauchgang_nr: "102", // should be coerced to integer
        ort: "   Canyon   ", // string with whitespace
        datum: "2026-06-22",
        sicht: 30, // should be coerced to string
        gewicht_kg: "8.5", // should be coerced to float
        dauer_min: null,
        tiefe_m: "not-a-number", // should be nullified
        temperatur_c: 28.6, // should be rounded to 29
        stroemung: undefined, // should be nullified
        unterschrift_partner: "", // empty should be nullified
        stempel: "Single Stamp" // string stempel should be array
      };

      extractDiveLog.mockResolvedValue(weirdMockResult);

      const buffer = Buffer.from('fake image content');
      const response = await request(app)
        .post('/api/upload')
        .attach('image', buffer, { filename: 'dive.png', contentType: 'image/png' });

      expect(response.status).toBe(200);
      expect(response.body.tauchgang_nr).toBe(102);
      expect(response.body.ort).toBe("Canyon");
      expect(response.body.sicht).toBe("30");
      expect(response.body.gewicht_kg).toBe(8.5);
      expect(response.body.dauer_min).toBeNull();
      expect(response.body.tiefe_m).toBeNull();
      expect(response.body.temperatur_c).toBe(29);
      expect(response.body.stroemung).toBeNull();
      expect(response.body.unterschrift_partner).toBeNull();
      expect(response.body.stempel).toEqual(["Single Stamp"]);
    });

    test('should reject if required field ort is missing in AI extraction result', async () => {
      extractDiveLog.mockResolvedValue({
        datum: "2026-06-22",
        tauchgang_nr: 10
      });

      const buffer = Buffer.from('fake image content');
      const response = await request(app)
        .post('/api/upload')
        .attach('image', buffer, { filename: 'dive.png', contentType: 'image/png' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('ort');
    });

    test('should reject if required field datum is missing in AI extraction result', async () => {
      extractDiveLog.mockResolvedValue({
        ort: "Canyon",
        tauchgang_nr: 10
      });

      const buffer = Buffer.from('fake image content');
      const response = await request(app)
        .post('/api/upload')
        .attach('image', buffer, { filename: 'dive.png', contentType: 'image/png' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('datum');
    });

    test('should return 500 error if Gemini API extraction fails', async () => {
      extractDiveLog.mockRejectedValue(new Error("API quota exceeded"));

      const buffer = Buffer.from('fake image content');
      const response = await request(app)
        .post('/api/upload')
        .attach('image', buffer, { filename: 'dive.png', contentType: 'image/png' });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('API quota exceeded');
    });
  });

  describe('Global Upload Validations', () => {
    test('should return 400 if no file is uploaded', async () => {
      const response = await request(app)
        .post('/api/upload');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('No file uploaded');
    });

    test('should return 400 if uploaded file is not an image mimetype', async () => {
      const buffer = Buffer.from('some pdf file content');
      const response = await request(app)
        .post('/api/upload')
        .attach('image', buffer, { filename: 'log.pdf', contentType: 'application/pdf' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('File mimetype is not an image');
    });

    test('should return 400 if filename suggests an empty file', async () => {
      const buffer = Buffer.from('');
      const response = await request(app)
        .post('/api/upload')
        .attach('image', buffer, { filename: 'empty_file.png', contentType: 'image/png' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('empty');
    });
  });

  describe('Simulation Mode (NODE_ENV === "test" or missing GEMINI_API_KEY)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
      process.env.GEMINI_API_KEY = '';
    });

    test('should return standard mock data for standard uploads', async () => {
      const buffer = Buffer.from('fake image data');
      const response = await request(app)
        .post('/api/upload')
        .attach('image', buffer, { filename: 'standard_log.png', contentType: 'image/png' });

      expect(response.status).toBe(200);
      expect(response.body.ort).toBe("Dahab Blue Hole");
      expect(response.body.tauchgang_nr).toBe(527);
      expect(extractDiveLog).not.toHaveBeenCalled();
    });

    test('should simulate invalid ocr error response', async () => {
      const buffer = Buffer.from('fake image data');
      const response = await request(app)
        .post('/api/upload')
        .attach('image', buffer, { filename: 'invalid_ocr.png', contentType: 'image/png' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('OCR processing failed');
    });

    test('should simulate large file payload too large response', async () => {
      const buffer = Buffer.from('fake image data');
      const response = await request(app)
        .post('/api/upload')
        .attach('image', buffer, { filename: 'large_file.png', contentType: 'image/png' });

      expect(response.status).toBe(413);
      expect(response.body.error).toContain('Payload Too Large');
    });

    test('should simulate null optional fields response', async () => {
      const buffer = Buffer.from('fake image data');
      const response = await request(app)
        .post('/api/upload')
        .attach('image', buffer, { filename: 'null_optional.png', contentType: 'image/png' });

      expect(response.status).toBe(200);
      expect(response.body.tauchgang_nr).toBeNull();
      expect(response.body.sicht).toBeNull();
      expect(response.body.stempel).toEqual([]);
    });
  });

  describe('Additional Boundary, Stress, and Edge-Case Validations', () => {
    describe('File Size Boundary Tests', () => {
      test('should accept a file of exactly 10MB', async () => {
        // Mock Gemini API so it resolves successfully if the file passes multer
        extractDiveLog.mockResolvedValue({
          ort: "Boundary Test",
          datum: "2026-06-22"
        });

        // 10MB is 10 * 1024 * 1024 = 10485760 bytes
        const tenMBBuffer = Buffer.alloc(10 * 1024 * 1024);
        
        const response = await request(app)
          .post('/api/upload')
          .attach('image', tenMBBuffer, { filename: 'exact_10mb.png', contentType: 'image/png' });

        expect(response.status).toBe(200);
      });

      test('should reject a file that is 10MB + 1 byte with 413 Payload Too Large', async () => {
        const slightlyOverLimitBuffer = Buffer.alloc(10 * 1024 * 1024 + 1);
        
        const response = await request(app)
          .post('/api/upload')
          .attach('image', slightlyOverLimitBuffer, { filename: 'over_limit.png', contentType: 'image/png' });

        expect(response.status).toBe(413);
        expect(response.body.error).toContain('Payload Too Large');
      });

      test('should reject a file that is 11MB with 413 Payload Too Large', async () => {
        const largeBuffer = Buffer.alloc(11 * 1024 * 1024);
        
        const response = await request(app)
          .post('/api/upload')
          .attach('image', largeBuffer, { filename: 'large_11mb.png', contentType: 'image/png' });

        expect(response.status).toBe(413);
        expect(response.body.error).toContain('Payload Too Large');
      });
    });

    describe('Mimetype Validation Edge-Cases', () => {
      test('should allow image/jpeg mimetype', async () => {
        extractDiveLog.mockResolvedValue({ ort: "Dahab", datum: "2026-06-22" });
        const buffer = Buffer.from('fake image content');
        const response = await request(app)
          .post('/api/upload')
          .attach('image', buffer, { filename: 'dive.jpg', contentType: 'image/jpeg' });
        expect(response.status).toBe(200);
      });

      test('should allow image/gif mimetype', async () => {
        extractDiveLog.mockResolvedValue({ ort: "Dahab", datum: "2026-06-22" });
        const buffer = Buffer.from('fake image content');
        const response = await request(app)
          .post('/api/upload')
          .attach('image', buffer, { filename: 'dive.gif', contentType: 'image/gif' });
        expect(response.status).toBe(200);
      });

      test('should reject text/plain mimetype', async () => {
        const buffer = Buffer.from('plain text content');
        const response = await request(app)
          .post('/api/upload')
          .attach('image', buffer, { filename: 'notes.txt', contentType: 'text/plain' });
        expect(response.status).toBe(400);
        expect(response.body.error).toContain('File mimetype is not an image');
      });

      test('should reject application/octet-stream mimetype', async () => {
        const buffer = Buffer.from('binary data');
        const response = await request(app)
          .post('/api/upload')
          .attach('image', buffer, { filename: 'data.bin', contentType: 'application/octet-stream' });
        expect(response.status).toBe(400);
        expect(response.body.error).toContain('File mimetype is not an image');
      });

      test('should reject missing or empty mimetype', async () => {
        const buffer = Buffer.from('binary data');
        const response = await request(app)
          .post('/api/upload')
          .attach('image', buffer, { filename: 'data.bin', contentType: '' });
        expect(response.status).toBe(400);
        expect(response.body.error).toContain('File mimetype is not an image');
      });
    });

    describe('Empty Files and Size Boundaries', () => {
      test('should reject a 0-byte file even if the filename does not suggest empty', async () => {
        const buffer = Buffer.from('');
        const response = await request(app)
          .post('/api/upload')
          .attach('image', buffer, { filename: 'normal_name.png', contentType: 'image/png' });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('File is empty');
      });

      test('should accept a 1-byte file as non-empty', async () => {
        extractDiveLog.mockResolvedValue({ ort: "Dahab", datum: "2026-06-22" });
        const buffer = Buffer.from('a');
        const response = await request(app)
          .post('/api/upload')
          .attach('image', buffer, { filename: 'one_byte.png', contentType: 'image/png' });

        expect(response.status).toBe(200);
      });
    });

    describe('Simulation Hooks', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'test';
        process.env.GEMINI_API_KEY = '';
      });

      test('should trigger null fields simulation with simulate_nulls filename hook', async () => {
        const buffer = Buffer.from('fake image data');
        const response = await request(app)
          .post('/api/upload')
          .attach('image', buffer, { filename: 'simulate_nulls.png', contentType: 'image/png' });

        expect(response.status).toBe(200);
        expect(response.body.tauchgang_nr).toBeNull();
        expect(response.body.sicht).toBeNull();
        expect(response.body.stempel).toEqual([]);
      });
    });
  });
});

