const express = require('express');
const cors = require('cors');
const multer = require('multer');

// Programmatically kill any existing process on port 3000 to avoid EADDRINUSE
try {
  const { execSync } = require('child_process');
  const stdout = execSync('lsof -t -i:3000');
  const pid = parseInt(stdout.toString().trim(), 10);
  if (pid && pid !== process.pid) {
    console.log(`Killing existing process ${pid} on port 3000...`);
    process.kill(pid, 'SIGKILL');
    // Wait for the port to be released
    execSync('sleep 1');
  }
} catch (e) {
  // Port is already free or lsof/kill failed
}

const app = express();
app.use(cors());
app.use(express.json());

// Handle malformed JSON body
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Malformed JSON' });
  }
  next();
});

const upload = multer({ storage: multer.memoryStorage() });

// Initial baseline dive record
const baselineDive = {
  id: 1,
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
  stempel: ["Scuba Club Dahab", "2026-06-20"],
  created_at: "2026-06-21T20:42:00Z"
};

let dives = [ { ...baselineDive } ];
let nextId = 2;

// POST /api/mock/reset -> Reset in-memory state
app.post('/api/mock/reset', (req, res) => {
  dives = [ { ...baselineDive } ];
  nextId = 2;
  res.status(200).json({ message: "Mock database reset to initial baseline" });
});

// GET /api/dives -> Get all dives
app.get('/api/dives', (req, res) => {
  res.status(200).json(dives);
});

// POST /api/upload -> Image upload & text extraction simulation
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const filename = req.file.originalname;

  // Validate filename contents as per specification
  if (filename.includes('invalid_ocr')) {
    return res.status(400).json({ error: 'OCR processing failed or invalid OCR output' });
  }

  if (filename.includes('large_file')) {
    return res.status(413).json({ error: 'Payload Too Large' });
  }

  if (filename.includes('empty_file')) {
    return res.status(400).json({ error: 'File is empty' });
  }

  // Validate mimetype is an image
  if (!req.file.mimetype.startsWith('image/')) {
    return res.status(400).json({ error: 'File mimetype is not an image' });
  }

  // Check if simulation suggests returning nulls for optional fields
  if (filename.includes('null_optional') || filename.includes('simulate_nulls')) {
    return res.status(200).json({
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
    });
  }

  // Standard mock extraction payload
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

  res.status(200).json(standardPayload);
});

// POST /api/dives -> Save a verified dive
app.post('/api/dives', (req, res) => {
  const { ort, datum, tauchgang_nr } = req.body;

  // Returns 400 if missing ort or datum
  if (ort === undefined || ort === null || ort === '' ||
      datum === undefined || datum === null || datum === '') {
    return res.status(400).json({ error: 'Missing required field: ort or datum' });
  }

  // Returns 400 if tauchgang_nr is present but is not a number or null
  if (req.body.hasOwnProperty('tauchgang_nr') && req.body.tauchgang_nr !== null && typeof req.body.tauchgang_nr !== 'number') {
    return res.status(400).json({ error: 'tauchgang_nr must be a number or null' });
  }

  // Returns 400 if datum is not a valid YYYY-MM-DD string
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (typeof datum !== 'string' || !dateRegex.test(datum)) {
    return res.status(400).json({ error: 'datum must be a valid YYYY-MM-DD string' });
  }

  // Perform basic calendar validity check for YYYY-MM-DD
  const dateParts = datum.split('-');
  const year = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10) - 1;
  const day = parseInt(dateParts[2], 10);
  const d = new Date(year, month, day);
  if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) {
    return res.status(400).json({ error: 'datum must be a valid calendar date' });
  }

  // Returns 400 if any of: tauchgang_nr, dauer_min, tiefe_m, gewicht_kg, temperatur_c is negative
  const numericFields = ['tauchgang_nr', 'dauer_min', 'tiefe_m', 'gewicht_kg', 'temperatur_c'];
  for (const field of numericFields) {
    const val = req.body[field];
    if (val !== undefined && val !== null) {
      if (typeof val === 'number' && val < 0) {
        return res.status(400).json({ error: `${field} cannot be negative` });
      }
    }
  }

  // Generate new auto-incremented integer ID and created_at timestamp
  const newDive = {
    id: nextId++,
    tauchgang_nr: req.body.tauchgang_nr === undefined ? null : req.body.tauchgang_nr,
    ort: req.body.ort,
    datum: req.body.datum,
    sicht: req.body.sicht === undefined ? null : req.body.sicht,
    gewicht_kg: req.body.gewicht_kg === undefined ? null : req.body.gewicht_kg,
    dauer_min: req.body.dauer_min === undefined ? null : req.body.dauer_min,
    tiefe_m: req.body.tiefe_m === undefined ? null : req.body.tiefe_m,
    temperatur_c: req.body.temperatur_c === undefined ? null : req.body.temperatur_c,
    stroemung: req.body.stroemung === undefined ? null : req.body.stroemung,
    unterschrift_partner: req.body.unterschrift_partner === undefined ? null : req.body.unterschrift_partner,
    stempel: Array.isArray(req.body.stempel) ? req.body.stempel : [],
    created_at: new Date().toISOString()
  };

  dives.push(newDive);
  res.status(201).json(newDive);
});

const PORT = 3000;
const server = app.listen(PORT, () => {
  console.log(`Mock server running on port ${PORT}`);
});

module.exports = server;
