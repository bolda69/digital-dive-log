# Handoff Report: Milestone 3 REST API Design

This report outlines the proposed design and recommendations for the backend REST API endpoints (GET `/api/dives` and POST `/api/dives`) for Milestone 3 of the Digital Dive Log project.

---

## 1. Observation

### Existing Structure & Files
* **`backend/src/app.js`**: Currently exposes only a health-check endpoint `/api/health` and configures CORS and JSON parsing:
  ```javascript
  // Line 8:
  app.use(express.json());
  // Lines 11-16: Graceful malformed JSON handler
  app.use((err, req, res, next) => { ... });
  // Lines 19-21:
  app.get('/api/health', (req, res) => { res.status(200).json({ status: 'ok' }); });
  ```
* **`backend/src/db.js`**: Provides the SQLite database wrapper.
  * `getAllDives()` (lines 204-220): Retrieves all dives sorted by `id DESC` and automatically parses the `stempel` JSON field back to an array.
  * `insertDive(dive)` (lines 131-177): Handles the serialization of the `stempel` field into a JSON string, inserts the record, and returns the full dive object (containing database-assigned `id` and `created_at`) via `getDiveById`.
* **`backend/src/db.adversarial.test.js`**: Shows that the SQLite layer itself does **not** validate data types or range limits for numeric fields (e.g. accepts text strings or negative values for `tauchgang_nr`, `gewicht_kg`, `dauer_min`, `tiefe_m`, and `temperatur_c`).
* **`e2e/api.spec.js`** & **`e2e/mock-server.js`**: Define the exact validation contracts required for input payloads on `POST /api/dives`:
  * `ort` and `datum` are required fields.
  * `datum` must be a valid calendar date matching regex `/^\d{4}-\d{2}-\d{2}$/`.
  * Numeric fields (`tauchgang_nr`, `dauer_min`, `tiefe_m`, `gewicht_kg`, `temperatur_c`) must be numbers and non-negative.
  * `stempel` must be a JavaScript Array or null.

---

## 2. Logic Chain

1. **Endpoint Implementation**: The project requirements mandate exposing `GET /api/dives` and `POST /api/dives` to fetch all stored logs and save new verified logs respectively.
2. **Database Integration**: Since `db.js` already provides `getAllDives()` and `insertDive(dive)` that correctly query SQLite and parse JSON arrays, the routes should import and delegate directly to these methods.
3. **Application-Layer Validation**: Since the SQLite database is dynamically typed and accepts invalid/impossible values (as seen in `db.adversarial.test.js`), all type-checking, constraint verification, and input validation must occur at the Express route/middleware layer prior to querying the database.
4. **Validation Requirements**: As specified in the E2E tests, the application must return a `400 Bad Request` code with an informative error message if any field validation fails.

---

## 3. Caveats

* **Test Database Initialization**: Unit tests (such as `app.test.js` or new route unit tests) do not automatically run `initDb()`. Therefore, any unit tests querying `/api/dives` must include `beforeAll` / `afterAll` blocks initializing an in-memory database (`await initDb(':memory:')`) and closing it (`await closeDb()`).
* **CORS and Payload Limits**: The existing middlewares in `app.js` already handle CORS, malformed JSON body errors, and request size limits (`413 Payload Too Large`), meaning individual routes do not need to implement these security measures separately.

---

## 4. Conclusion

We recommend organizing the endpoints using Express routers to keep route handlers modular and clean.

### Route Recommendations & Proposals

#### A. Create `backend/src/routes.js`
This file will contain the endpoint declarations and input validation middleware:

```javascript
const express = require('express');
const { getAllDives, insertDive } = require('./db');

const router = express.Router();

// Input validation middleware
const validateDiveInput = (req, res, next) => {
  const { ort, datum, tauchgang_nr, dauer_min, tiefe_m, gewicht_kg, temperatur_c, stempel } = req.body;

  // 1. Required fields checks
  if (ort === undefined || ort === null || ort === '') {
    return res.status(400).json({ error: 'Missing required field: ort' });
  }
  if (typeof ort !== 'string') {
    return res.status(400).json({ error: 'ort must be a string' });
  }

  if (datum === undefined || datum === null || datum === '') {
    return res.status(400).json({ error: 'Missing required field: datum' });
  }

  // 2. Format check: YYYY-MM-DD
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (typeof datum !== 'string' || !dateRegex.test(datum)) {
    return res.status(400).json({ error: 'datum must be a valid YYYY-MM-DD string' });
  }

  // 3. Calendar semantic date check
  const dateParts = datum.split('-');
  const year = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10) - 1;
  const day = parseInt(dateParts[2], 10);
  const d = new Date(year, month, day);
  if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) {
    return res.status(400).json({ error: 'datum must be a valid calendar date' });
  }

  // 4. Specific type constraint on tauchgang_nr (must not be string, boolean, etc.)
  if (req.body.hasOwnProperty('tauchgang_nr') && req.body.tauchgang_nr !== null && typeof req.body.tauchgang_nr !== 'number') {
    return res.status(400).json({ error: 'tauchgang_nr must be a number or null' });
  }

  // 5. Value constraints: numeric fields must be non-negative
  const numericFields = ['tauchgang_nr', 'dauer_min', 'tiefe_m', 'gewicht_kg', 'temperatur_c'];
  for (const field of numericFields) {
    const val = req.body[field];
    if (val !== undefined && val !== null) {
      if (typeof val !== 'number') {
        return res.status(400).json({ error: `${field} must be a number` });
      }
      if (val < 0) {
        return res.status(400).json({ error: `${field} cannot be negative` });
      }
    }
  }

  // 6. Array constraints: stempel must be a valid array if provided
  if (req.body.hasOwnProperty('stempel') && stempel !== null && !Array.isArray(stempel)) {
    return res.status(400).json({ error: 'stempel must be an array or null' });
  }

  next();
};

// GET /api/dives -> Returns all dives (parsed stempel, ordered DESC)
router.get('/dives', async (req, res, next) => {
  try {
    const dives = await getAllDives();
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(dives);
  } catch (error) {
    next(error);
  }
});

// POST /api/dives -> Inserts a new validated dive and returns it
router.post('/dives', validateDiveInput, async (req, res, next) => {
  try {
    const savedDive = await insertDive(req.body);
    return res.status(201).json(savedDive);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
```

#### B. Mount Routes in `backend/src/app.js`
To integrate the new routing:

```javascript
// Add inside backend/src/app.js:
const routes = require('./routes');

// Mount under /api
app.use('/api', routes);
```

#### C. Handle Errors Globally in `backend/src/app.js`
Ensure any database or parsing failure is captured gracefully:

```javascript
app.use((err, req, res, next) => {
  console.error(err);
  return res.status(500).json({ error: 'Internal Server Error' });
});
```

---

## 5. Verification Method

### 1. Verification Commands
To verify the implementation once coded, run:
* **Backend Unit Tests**:
  ```bash
  npm --prefix backend test
  ```
  Ensure all unit tests in `backend/src/app.test.js` and `backend/src/db.test.js` pass.
* **E2E Integration/Validation Tests**:
  ```bash
  # Ensure the backend server runs in background
  npm --prefix backend start &
  
  # Run the e2e test suite (focusing on dive API endpoints)
  npx playwright test e2e/api.spec.js
  ```
  All 38 test suites (focusing on Tiers 1-4 validation rules) must pass successfully.

### 2. Validation Fail Conditions
The verification is invalid if:
* Negative numbers (e.g. `gewicht_kg = -5`) do not trigger a `400 Bad Request`.
* String representations of numbers (e.g. `tauchgang_nr = "527"`) do not trigger a `400 Bad Request`.
* Invalid calendar dates (e.g. `datum = "2026-06-32"`) are accepted.
* The route returns database values without parsing `stempel` back into a JS array.
