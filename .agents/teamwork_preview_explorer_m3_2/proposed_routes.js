const express = require('express');
const router = express.Router();
const db = require('./db');

/**
 * Validation Middleware for creating/updating a dive log.
 * Enforces schema constraints and prevents bad/adversarial data.
 */
function validateDive(req, res, next) {
  const {
    ort,
    datum,
    tauchgang_nr,
    dauer_min,
    tiefe_m,
    gewicht_kg,
    temperatur_c,
    sicht,
    stroemung,
    unterschrift_partner,
    stempel
  } = req.body;

  // 1. Required fields presence and non-empty check
  if (
    ort === undefined || ort === null || ort === '' ||
    datum === undefined || datum === null || datum === ''
  ) {
    return res.status(400).json({ error: 'Missing required field: ort or datum' });
  }

  // 2. Required fields type check
  if (typeof ort !== 'string') {
    return res.status(400).json({ error: 'ort must be a string' });
  }

  // 3. Date format validation (strict YYYY-MM-DD format regex)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (typeof datum !== 'string' || !dateRegex.test(datum)) {
    return res.status(400).json({ error: 'datum must be a valid YYYY-MM-DD string' });
  }

  // 4. Date calendar logic validation (prevent invalid dates like 2026-06-32)
  const dateParts = datum.split('-');
  const year = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10) - 1; // 0-based month in JavaScript
  const day = parseInt(dateParts[2], 10);
  const dateObj = new Date(year, month, day);

  if (
    dateObj.getFullYear() !== year ||
    dateObj.getMonth() !== month ||
    dateObj.getDate() !== day
  ) {
    return res.status(400).json({ error: 'datum must be a valid calendar date' });
  }

  // 5. Explicit check for tauchgang_nr type if present
  if (req.body.hasOwnProperty('tauchgang_nr') && tauchgang_nr !== null) {
    if (typeof tauchgang_nr !== 'number') {
      return res.status(400).json({ error: 'tauchgang_nr must be a number or null' });
    }
  }

  // 6. Non-negativity check for numerical fields
  const numericFields = {
    tauchgang_nr: 'tauchgang_nr',
    dauer_min: 'dauer_min',
    tiefe_m: 'tiefe_m',
    gewicht_kg: 'gewicht_kg',
    temperatur_c: 'temperatur_c'
  };

  for (const [key, fieldName] of Object.entries(numericFields)) {
    const val = req.body[key];
    if (val !== undefined && val !== null) {
      if (typeof val !== 'number') {
        return res.status(400).json({ error: `${fieldName} must be a number` });
      }
      if (val < 0) {
        return res.status(400).json({ error: `${fieldName} cannot be negative` });
      }
    }
  }

  // 7. String format/type validations for optional text fields
  const textFields = {
    sicht: 'sicht',
    stroemung: 'stroemung',
    unterschrift_partner: 'unterschrift_partner'
  };

  for (const [key, fieldName] of Object.entries(textFields)) {
    const val = req.body[key];
    if (val !== undefined && val !== null && typeof val !== 'string') {
      return res.status(400).json({ error: `${fieldName} must be a string` });
    }
  }

  // 8. stempel validation (must be an array of strings if provided)
  if (stempel !== undefined && stempel !== null) {
    if (!Array.isArray(stempel)) {
      return res.status(400).json({ error: 'stempel must be an array' });
    }
    for (let i = 0; i < stempel.length; i++) {
      if (typeof stempel[i] !== 'string') {
        return res.status(400).json({ error: 'stempel elements must be strings' });
      }
    }
  }

  next();
}

/**
 * GET /api/dives
 * Returns all dives from the database, ordered by ID DESC.
 */
router.get('/dives', async (req, res, next) => {
  try {
    const dives = await db.getAllDives();
    return res.status(200).json(dives);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/dives
 * Creates a new dive log entry, performing type and input validations first.
 */
router.post('/dives', validateDive, async (req, res, next) => {
  try {
    const diveData = {
      tauchgang_nr: req.body.tauchgang_nr !== undefined ? req.body.tauchgang_nr : null,
      ort: req.body.ort,
      datum: req.body.datum,
      sicht: req.body.sicht !== undefined ? req.body.sicht : null,
      gewicht_kg: req.body.gewicht_kg !== undefined ? req.body.gewicht_kg : null,
      dauer_min: req.body.dauer_min !== undefined ? req.body.dauer_min : null,
      tiefe_m: req.body.tiefe_m !== undefined ? req.body.tiefe_m : null,
      temperatur_c: req.body.temperatur_c !== undefined ? req.body.temperatur_c : null,
      stroemung: req.body.stroemung !== undefined ? req.body.stroemung : null,
      unterschrift_partner: req.body.unterschrift_partner !== undefined ? req.body.unterschrift_partner : null,
      stempel: Array.isArray(req.body.stempel) ? req.body.stempel : []
    };

    const newDive = await db.insertDive(diveData);
    return res.status(201).json(newDive);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
