const request = require('supertest');
const app = require('./app');
const { extractDiveLog } = require('./gemini');

jest.mock('./gemini');

describe('POST /api/upload - Adversarial, Boundary & Simulation Tests', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalApiKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    // Default: production environment with API key to test the real Gemini integration path
    process.env.NODE_ENV = 'production';
    process.env.GEMINI_API_KEY = 'mocked-api-key';
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.GEMINI_API_KEY = originalApiKey;
  });

  describe('File Size Validation (10MB Limit)', () => {
    test('should reject files exceeding the 10MB limit with status 413', async () => {
      // 10MB is 10 * 1024 * 1024 bytes. Let's send 10MB + 1 byte.
      const oversizeBuffer = Buffer.alloc(10 * 1024 * 1024 + 1);
      
      const response = await request(app)
        .post('/api/upload')
        .attach('image', oversizeBuffer, { filename: 'too_large.png', contentType: 'image/png' });

      expect(response.status).toBe(413);
      expect(response.body).toEqual({ error: 'Payload Too Large' });
      expect(extractDiveLog).not.toHaveBeenCalled();
    });

    test('should accept files exactly at the 10MB limit', async () => {
      const exactBuffer = Buffer.alloc(10 * 1024 * 1024);
      
      extractDiveLog.mockResolvedValue({
        ort: 'Exact Size Dive Site',
        datum: '2026-06-22'
      });

      const response = await request(app)
        .post('/api/upload')
        .attach('image', exactBuffer, { filename: 'exact_size.png', contentType: 'image/png' });

      expect(response.status).toBe(200);
      expect(response.body.ort).toBe('Exact Size Dive Site');
      expect(extractDiveLog).toHaveBeenCalledTimes(1);
    });

    test('should reject via simulation hook when filename suggests large_file.png', async () => {
      process.env.NODE_ENV = 'test';
      process.env.GEMINI_API_KEY = '';

      const buffer = Buffer.from('small buffer');
      const response = await request(app)
        .post('/api/upload')
        .attach('image', buffer, { filename: 'large_file.png', contentType: 'image/png' });

      expect(response.status).toBe(413);
      expect(response.body).toEqual({ error: 'Payload Too Large' });
    });
  });

  describe('Mimetype Validation (Image Only)', () => {
    const invalidTypes = [
      'application/pdf',
      'text/plain',
      'application/json',
      'application/octet-stream',
      'audio/mpeg',
      'video/mp4'
    ];

    invalidTypes.forEach(mimeType => {
      test(`should reject file upload with mimetype: ${mimeType}`, async () => {
        const buffer = Buffer.from('dummy content');
        const response = await request(app)
          .post('/api/upload')
          .attach('image', buffer, { filename: `test_file`, contentType: mimeType });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('File mimetype is not an image');
        expect(extractDiveLog).not.toHaveBeenCalled();
      });
    });

    test('should reject file upload when mimetype is undefined/missing', async () => {
      const buffer = Buffer.from('dummy content');
      const response = await request(app)
        .post('/api/upload')
        .attach('image', buffer, 'test_file'); // omitted options

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('File mimetype is not an image');
    });

    const validTypes = [
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp'
    ];

    validTypes.forEach(mimeType => {
      test(`should accept file upload with valid mimetype: ${mimeType}`, async () => {
        const buffer = Buffer.from('dummy image content');
        
        extractDiveLog.mockResolvedValue({
          ort: 'Mime Test Site',
          datum: '2026-06-22'
        });

        const response = await request(app)
          .post('/api/upload')
          .attach('image', buffer, { filename: 'valid_image', contentType: mimeType });

        expect(response.status).toBe(200);
        expect(response.body.ort).toBe('Mime Test Site');
      });
    });
  });

  describe('Empty Files Validation', () => {
    test('should reject if buffer size is 0 and filename does not suggest empty', async () => {
      const emptyBuffer = Buffer.alloc(0);
      
      const response = await request(app)
        .post('/api/upload')
        .attach('image', emptyBuffer, { filename: 'real_image.png', contentType: 'image/png' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('File is empty');
      expect(extractDiveLog).not.toHaveBeenCalled();
    });

    test('should reject if filename contains "empty_file" even if buffer size is > 0', async () => {
      const normalBuffer = Buffer.from('some fake image data');
      
      const response = await request(app)
        .post('/api/upload')
        .attach('image', normalBuffer, { filename: 'some_empty_file_here.png', contentType: 'image/png' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('File is empty');
      expect(extractDiveLog).not.toHaveBeenCalled();
    });

    test('should reject if buffer size is 0 and filename suggests empty_file', async () => {
      const emptyBuffer = Buffer.alloc(0);
      
      const response = await request(app)
        .post('/api/upload')
        .attach('image', emptyBuffer, { filename: 'empty_file.png', contentType: 'image/png' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('File is empty');
    });
  });

  describe('Simulation Hooks', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
      process.env.GEMINI_API_KEY = '';
    });

    test('should return 400 for invalid_ocr simulation filename', async () => {
      const buffer = Buffer.from('fake image');
      const response = await request(app)
        .post('/api/upload')
        .attach('image', buffer, { filename: 'some_invalid_ocr_log.png', contentType: 'image/png' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('OCR processing failed or invalid OCR output');
    });

    test('should return 200 standard payload for standard simulation filename', async () => {
      const buffer = Buffer.from('fake image');
      const response = await request(app)
        .post('/api/upload')
        .attach('image', buffer, { filename: 'dive_log_regular.png', contentType: 'image/png' });

      expect(response.status).toBe(200);
      expect(response.body.ort).toBe('Dahab Blue Hole');
      expect(response.body.tauchgang_nr).toBe(527);
    });

    test('should return 200 with null fields for null_optional or simulate_nulls simulation filename', async () => {
      const buffer = Buffer.from('fake image');
      
      const response1 = await request(app)
        .post('/api/upload')
        .attach('image', buffer, { filename: 'null_optional.png', contentType: 'image/png' });
      
      expect(response1.status).toBe(200);
      expect(response1.body.tauchgang_nr).toBeNull();
      expect(response1.body.ort).toBe('Dahab Blue Hole');

      const response2 = await request(app)
        .post('/api/upload')
        .attach('image', buffer, { filename: 'simulate_nulls_test.png', contentType: 'image/png' });

      expect(response2.status).toBe(200);
      expect(response2.body.tauchgang_nr).toBeNull();
      expect(response2.body.ort).toBe('Dahab Blue Hole');
    });
  });

  describe('Coercion and Validation of AI Extraction Output (Real Gemini Path)', () => {
    test('should return 400 if Gemini returns non-object or null output', async () => {
      extractDiveLog.mockResolvedValue(null);

      const buffer = Buffer.from('fake image');
      const response = await request(app)
        .post('/api/upload')
        .attach('image', buffer, { filename: 'image.png', contentType: 'image/png' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('AI extraction returned an invalid result');
    });

    test('should reject if required field ort is missing, null, or only whitespace', async () => {
      const buffer = Buffer.from('fake image');

      // missing ort
      extractDiveLog.mockResolvedValue({ datum: '2026-06-22' });
      let response = await request(app)
        .post('/api/upload')
        .attach('image', buffer, { filename: 'image.png', contentType: 'image/png' });
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('missing required field ort');

      // null ort
      extractDiveLog.mockResolvedValue({ ort: null, datum: '2026-06-22' });
      response = await request(app)
        .post('/api/upload')
        .attach('image', buffer, { filename: 'image.png', contentType: 'image/png' });
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('missing required field ort');

      // whitespace ort
      extractDiveLog.mockResolvedValue({ ort: '    ', datum: '2026-06-22' });
      response = await request(app)
        .post('/api/upload')
        .attach('image', buffer, { filename: 'image.png', contentType: 'image/png' });
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('missing required field ort');
    });

    test('should reject if required field datum is missing, null, or only whitespace', async () => {
      const buffer = Buffer.from('fake image');

      // missing datum
      extractDiveLog.mockResolvedValue({ ort: 'Dahab' });
      let response = await request(app)
        .post('/api/upload')
        .attach('image', buffer, { filename: 'image.png', contentType: 'image/png' });
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('missing required field datum');

      // null datum
      extractDiveLog.mockResolvedValue({ ort: 'Dahab', datum: null });
      response = await request(app)
        .post('/api/upload')
        .attach('image', buffer, { filename: 'image.png', contentType: 'image/png' });
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('missing required field datum');

      // whitespace datum
      extractDiveLog.mockResolvedValue({ ort: 'Dahab', datum: '\t\n ' });
      response = await request(app)
        .post('/api/upload')
        .attach('image', buffer, { filename: 'image.png', contentType: 'image/png' });
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('missing required field datum');
    });

    test('should successfully coerce and sanitize all optional fields', async () => {
      extractDiveLog.mockResolvedValue({
        ort: '  Elphinstone  ',
        datum: '2026-06-22 \n',
        tauchgang_nr: '99.7', // float string, should be rounded to 100
        dauer_min: '45', // string integer, should be coerced to 45
        tiefe_m: '28.52', // string float, should be coerced to 28.52
        gewicht_kg: 8.54, // float, should remain 8.54
        temperatur_c: 'not-a-number', // invalid string, should become null
        sicht: 30, // number, should become string '30'
        stroemung: true, // boolean, should become string 'true'
        unterschrift_partner: null, // null should stay null
        stempel: 'Stamp Name' // string should become array ['Stamp Name']
      });

      const buffer = Buffer.from('fake image');
      const response = await request(app)
        .post('/api/upload')
        .attach('image', buffer, { filename: 'image.png', contentType: 'image/png' });

      expect(response.status).toBe(200);
      expect(response.body.ort).toBe('Elphinstone');
      expect(response.body.datum).toBe('2026-06-22');
      expect(response.body.tauchgang_nr).toBe(100);
      expect(response.body.dauer_min).toBe(45);
      expect(response.body.tiefe_m).toBe(28.52);
      expect(response.body.gewicht_kg).toBe(8.54);
      expect(response.body.temperatur_c).toBeNull();
      expect(response.body.sicht).toBe('30');
      expect(response.body.stroemung).toBe('true');
      expect(response.body.unterschrift_partner).toBeNull();
      expect(response.body.stempel).toEqual(['Stamp Name']);
    });

    test('should handle stempel array mapping and filtering correctly', async () => {
      extractDiveLog.mockResolvedValue({
        ort: 'Dahab',
        datum: '2026-06-22',
        stempel: ['Stamp 1', null, undefined, 45, 'Stamp 2']
      });

      const buffer = Buffer.from('fake image');
      const response = await request(app)
        .post('/api/upload')
        .attach('image', buffer, { filename: 'image.png', contentType: 'image/png' });

      expect(response.status).toBe(200);
      // Falsy elements filtered out, and non-strings mapped to strings
      expect(response.body.stempel).toEqual(['Stamp 1', '45', 'Stamp 2']);
    });

    test('should fallback to empty array if stempel is invalid type', async () => {
      extractDiveLog.mockResolvedValue({
        ort: 'Dahab',
        datum: '2026-06-22',
        stempel: { not: 'valid' }
      });

      const buffer = Buffer.from('fake image');
      const response = await request(app)
        .post('/api/upload')
        .attach('image', buffer, { filename: 'image.png', contentType: 'image/png' });

      expect(response.status).toBe(200);
      expect(response.body.stempel).toEqual([]);
    });
  });
});
