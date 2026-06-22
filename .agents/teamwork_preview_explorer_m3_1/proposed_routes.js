const express = require('express');
const router = express.Router();
const { insertDive, getAllDives, getDb, initDb } = require('./db');

/**
 * GET /api/dives
 * Returns all dives with parsed stempel array, ordered by ID descending.
 */
router.get('/dives', async (req, res) => {
  try {
    const dives = await getAllDives();
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(dives);
  } catch (error) {
    console.error('Error fetching dives:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * POST /api/dives
 * Validates request body, inserts new dive, and returns the inserted record.
 */
router.post('/dives', async (req, res) => {
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

  // 1. Required Fields Validation (ort and datum are required and must be non-empty strings)
  if (ort === undefined || ort === null || ort === '') {
    return res.status(400).json({ error: "Missing required field: ort" });
  }
  if (typeof ort !== 'string') {
    return res.status(400).json({ error: "ort must be a string" });
  }

  if (datum === undefined || datum === null || datum === '') {
    return res.status(400).json({ error: "Missing required field: datum" });
  }
  if (typeof datum !== 'string') {
    return res.status(400).json({ error: "datum must be a string" });
  }

  // 2. Date Format Validation (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(datum)) {
    return res.status(400).json({ error: 'datum must be a valid YYYY-MM-DD string' });
  }

  // Calendar validity (handling month bounds and leap years)
  const dateParts = datum.split('-');
  const year = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10) - 1; // 0-indexed month
  const day = parseInt(dateParts[2], 10);
  const dateObj = new Date(year, month, day);

  if (dateObj.getFullYear() !== year || dateObj.getMonth() !== month || dateObj.getDate() !== day) {
    return res.status(400).json({ error: 'datum must be a valid calendar date' });
  }

  // 3. Type & Range Validation for Numeric Fields
  const numericFields = ['tauchgang_nr', 'dauer_min', 'tiefe_m', 'gewicht_kg', 'temperatur_c'];
  for (const field of numericFields) {
    if (req.body.hasOwnProperty(field)) {
      const val = req.body[field];
      if (val !== null && val !== undefined) {
        if (typeof val !== 'number') {
          return res.status(400).json({ error: `${field} must be a number or null` });
        }
        if (val < 0) {
          return res.status(400).json({ error: `${field} cannot be negative` });
        }
      }
    }
  }

  // 4. Stempel Validation (must be an array of strings if provided)
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
      tauchgang_nr: tauchgang_nr === undefined ? null : tauchgang_nr,
      ort,
      datum,
      sicht: sicht === undefined ? null : sicht,
      gewicht_kg: gewicht_kg === undefined ? null : gewicht_kg,
      dauer_min: dauer_min === undefined ? null : dauer_min,
      tiefe_m: tiefe_m === undefined ? null : tiefe_m,
      temperatur_c: temperatur_c === undefined ? null : temperatur_c,
      stroemung: stroemung === undefined ? null : stroemung,
      unterschrift_partner: unterschrift_partner === undefined ? null : unterschrift_partner,
      stempel: stempel === undefined ? null : stempel
    });

    res.setHeader('Content-Type', 'application/json');
    return res.status(201).json(record);
  } catch (error) {
    console.error('Error inserting dive:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Conditionally expose /mock/reset for testing purposes (isolated state verification)
if (process.env.NODE_ENV === 'test') {
  router.post('/mock/reset', async (req, res) => {
    try {
      const dbInstance = getDb(); // Using getDb from db module
      if (!dbInstance) {
        // Fallback initialization if tests run standalone without starting server
        await initDb();
      }
      
      const db = getDb();
      await db.run('DELETE FROM dives');
      await db.run('DELETE FROM sqlite_sequence WHERE name="dives"');
      
      // Reseed baseline dive
      await insertDive({
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

      return res.status(200).json({ message: "Mock database reset to initial baseline" });
    } catch (error) {
      console.error('Error resetting database in test env:', error);
      return res.status(500).json({ error: 'Failed to reset test database: ' + error.message });
    }
  });
}

module.exports = router;
