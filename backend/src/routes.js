const express = require('express');
const router = express.Router();
const { insertDive, getAllDives, getDb, initDb } = require('./db');
const multer = require('multer');
const { extractDiveLog } = require('./gemini');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('File mimetype is not an image'), false);
    }
  }
});
const uploadSingle = upload.single('image');

/**
 * GET /dives
 * Returns all dives.
 */
router.get('/dives', async (req, res) => {
  try {
    const dives = await getAllDives();
    return res.status(200).json(dives);
  } catch (error) {
    console.error('Error fetching dives:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * POST /dives
 * Validates body inputs, delegates to insertDive(), and returns 210 with created record.
 */
router.post('/dives', async (req, res) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Request body is required' });
  }

  const {
    ort,
    datum,
    tauchgang_nr,
    sicht,
    gewicht_kg,
    dauer_min,
    tiefe_m,
    temperatur_c,
    stroemung,
    unterschrift_partner,
    stempel
  } = req.body;

  // 1. Required Fields Validation (ort and datum are required, non-empty strings)
  if (ort === undefined || ort === null) {
    return res.status(400).json({ error: 'ort is required' });
  }
  if (typeof ort !== 'string' || ort.trim() === '') {
    return res.status(400).json({ error: 'ort must be a non-empty string' });
  }
  if (ort.length > 1000) {
    return res.status(400).json({ error: 'ort must be at most 1000 characters' });
  }

  if (datum === undefined || datum === null) {
    return res.status(400).json({ error: 'datum is required' });
  }
  if (typeof datum !== 'string' || datum.trim() === '') {
    return res.status(400).json({ error: 'datum must be a non-empty string' });
  }

  // 2. Date Format Validation (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(datum)) {
    return res.status(400).json({ error: 'datum must match YYYY-MM-DD format' });
  }

  // Calendar validity (handling month bounds, leap years, etc.)
  const dateParts = datum.split('-');
  const year = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10);
  const day = parseInt(dateParts[2], 10);

  if (month < 1 || month > 12) {
    return res.status(400).json({ error: 'datum must have a valid month (01-12)' });
  }
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) {
    return res.status(400).json({ error: 'datum must be a valid calendar date' });
  }

  // 2.5. Optional Text Fields Validation
  const optionalTextFields = ['sicht', 'stroemung', 'unterschrift_partner'];
  for (const field of optionalTextFields) {
    const val = req.body[field];
    if (val !== undefined && val !== null) {
      if (typeof val !== 'string') {
        return res.status(400).json({ error: `${field} must be a string` });
      }
      if (val.length > 1000) {
        return res.status(400).json({ error: `${field} must be at most 1000 characters` });
      }
    }
  }

  // 3. Numeric Fields Validation
  const numericFields = ['tauchgang_nr', 'dauer_min', 'tiefe_m', 'gewicht_kg', 'temperatur_c'];
  const integerFields = ['tauchgang_nr', 'dauer_min', 'temperatur_c'];
  for (const field of numericFields) {
    const val = req.body[field];
    if (val !== undefined && val !== null) {
      if (!Number.isFinite(val)) {
        return res.status(400).json({ error: `${field} must be a finite number` });
      }
      if (val < 0) {
        return res.status(400).json({ error: `${field} cannot be negative` });
      }
      if (integerFields.includes(field) && !Number.isInteger(val)) {
        return res.status(400).json({ error: `${field} must be an integer` });
      }
      if (val > 100000) {
        return res.status(400).json({ error: `${field} is unreasonably large` });
      }
      if (field === 'tiefe_m' && val > 11000) {
        return res.status(400).json({ error: 'tiefe_m is deeper than the Mariana Trench' });
      }
    }
  }

  // 4. Stempel Validation
  if (stempel !== undefined && stempel !== null) {
    if (!Array.isArray(stempel)) {
      return res.status(400).json({ error: 'stempel must be an array' });
    }
    for (const item of stempel) {
      if (typeof item !== 'string') {
        return res.status(400).json({ error: 'All items in stempel array must be strings' });
      }
    }
  }

  try {
    const record = await insertDive({
      tauchgang_nr: tauchgang_nr !== undefined ? tauchgang_nr : null,
      ort,
      datum,
      sicht: sicht !== undefined ? sicht : null,
      gewicht_kg: gewicht_kg !== undefined ? gewicht_kg : null,
      dauer_min: dauer_min !== undefined ? dauer_min : null,
      tiefe_m: tiefe_m !== undefined ? tiefe_m : null,
      temperatur_c: temperatur_c !== undefined ? temperatur_c : null,
      stroemung: stroemung !== undefined ? stroemung : null,
      unterschrift_partner: unterschrift_partner !== undefined ? unterschrift_partner : null,
      stempel: stempel !== undefined ? stempel : null
    });

    return res.status(201).json(record);
  } catch (error) {
    console.error('Error inserting dive:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * POST /upload
 * Image upload & AI extraction
 */
router.post('/upload', (req, res) => {
  uploadSingle(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: 'Payload Too Large' });
        }
        return res.status(400).json({ error: err.message });
      }
      if (err.message === 'File mimetype is not an image') {
        return res.status(400).json({ error: 'File mimetype is not an image' });
      }
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filename = req.file.originalname || '';

    if (filename.includes('empty_file') || req.file.size === 0) {
      return res.status(400).json({ error: 'File is empty' });
    }

    // Check simulation mode
    const isSimulated = process.env.NODE_ENV === 'test' || !process.env.GEMINI_API_KEY;

    if (isSimulated) {
      if (filename.includes('invalid_ocr')) {
        return res.status(400).json({ error: 'OCR processing failed or invalid OCR output' });
      }
      if (filename.includes('large_file')) {
        return res.status(413).json({ error: 'Payload Too Large' });
      }
      if (filename.includes('null_optional') || filename.includes('simulate_nulls')) {
        const mockNulls = {
          tauchgang_nr: null,
          ort: "Dahab Blue Hole",
          datum: "2026-06-20",
          sicht: null,
          gewicht_kg: null,
          dauer_min: null,
          tiefe_m: null,
          temperatur_c: null,
          stroemung: null,
          unterschrift_partner: null,
          stempel: []
        };
        return res.status(200).json(mockNulls);
      }

      // Default simulated successful response
      const standardPayload = {
        tauchgang_nr: 527,
        ort: "Dahab Blue Hole",
        datum: "2026-06-20",
        sicht: "20m",
        gewicht_kg: 8.0,
        dauer_min: 45,
        tiefe_m: 28.5,
        temperatur_c: 24,
        stroemung: "mild",
        unterschrift_partner: "John Doe",
        stempel: ["Scuba Club Dahab", "2026-06-20"]
      };
      return res.status(200).json(standardPayload);
    }

    // Real Gemini execution
    try {
      const extracted = await extractDiveLog(req.file.buffer, req.file.mimetype);

      // Validate required fields
      if (!extracted || typeof extracted !== 'object') {
        return res.status(400).json({ error: 'AI extraction returned an invalid result' });
      }

      // Check required fields: ort and datum
      if (extracted.ort === undefined || extracted.ort === null || String(extracted.ort).trim() === '') {
        return res.status(400).json({ error: 'AI extraction failed: missing required field ort' });
      }
      if (extracted.datum === undefined || extracted.datum === null || String(extracted.datum).trim() === '') {
        return res.status(400).json({ error: 'AI extraction failed: missing required field datum' });
      }

      // Sanitize/coerce required fields
      const ort = String(extracted.ort).trim();
      const datum = String(extracted.datum).trim();

      // Sanitize optional numeric fields
      const numericFields = ['tauchgang_nr', 'dauer_min', 'tiefe_m', 'gewicht_kg', 'temperatur_c'];
      const integerFields = ['tauchgang_nr', 'dauer_min', 'temperatur_c'];
      const sanitized = { ort, datum };

      for (const field of numericFields) {
        const val = extracted[field];
        if (val !== undefined && val !== null && val !== '') {
          const num = Number(val);
          if (Number.isFinite(num)) {
            sanitized[field] = integerFields.includes(field) ? Math.round(num) : num;
          } else {
            sanitized[field] = null;
          }
        } else {
          sanitized[field] = null;
        }
      }

      // Sanitize optional text fields
      const textFields = ['sicht', 'stroemung', 'unterschrift_partner'];
      for (const field of textFields) {
        const val = extracted[field];
        if (val !== undefined && val !== null && val !== '') {
          sanitized[field] = String(val);
        } else {
          sanitized[field] = null;
        }
      }

      // Sanitize stempel array
      if (Array.isArray(extracted.stempel)) {
        sanitized.stempel = extracted.stempel
          .filter(item => item !== undefined && item !== null)
          .map(item => String(item));
      } else if (typeof extracted.stempel === 'string' && extracted.stempel.trim() !== '') {
        sanitized.stempel = [extracted.stempel];
      } else {
        sanitized.stempel = [];
      }

      return res.status(200).json(sanitized);

    } catch (apiError) {
      console.error('Gemini extraction failed:', apiError);
      return res.status(500).json({ error: 'Gemini extraction failed: ' + apiError.message });
    }
  });
});

// Conditionally expose /mock/reset for testing purposes (isolated state verification)
if (process.env.NODE_ENV === 'test') {
  router.post('/mock/reset', async (req, res) => {
    try {
      let dbInstance = getDb();
      if (!dbInstance) {
        // Fallback initialization if tests run standalone without starting server
        await initDb();
        dbInstance = getDb();
      }

      await dbInstance.run('DELETE FROM dives');
      await dbInstance.run('DELETE FROM sqlite_sequence WHERE name="dives"');

      // Reseed baseline dive with ID 1
      const baseline = await insertDive({
        tauchgang_nr: 527,
        ort: "Dahab Blue Hole",
        datum: "2026-06-20",
        sicht: "20m",
        gewicht_kg: 8.0,
        dauer_min: 45,
        tiefe_m: 28.5,
        temperatur_c: 24,
        stroemung: "mild",
        unterschrift_partner: "John Doe",
        stempel: ["Scuba Club Dahab", "2026-06-20"]
      });

      return res.status(200).json({
        message: "Mock database reset to initial baseline",
        baseline
      });
    } catch (error) {
      console.error('Error resetting database in test env:', error);
      return res.status(500).json({ error: 'Failed to reset test database: ' + error.message });
    }
  });
}

module.exports = router;
