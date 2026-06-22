# Handoff Report — Milestone 3 Backend API Endpoints Verification

## Challenge Summary
**Overall risk assessment**: MEDIUM

---

## Challenges

### [Medium] Challenge 1: Lack of Input Validation on Optional Fields (`sicht`, `stroemung`, `unterschrift_partner`)
- **Assumption challenged**: Optional fields do not require type validation.
- **Attack scenario**: A client POSTs `/api/dives` with a nested object/array or other non-string value for `sicht` (e.g., `sicht: { "visibility": "15m" }`). Since there is no type validation on `sicht`, the raw object is passed to `insertDive` and bound in the sqlite3 driver.
- **Blast radius**: If the driver throws a binding error, the application returns a `500 Internal Server Error` instead of a validation `400 Bad Request`. If it succeeds, it pollutes the database with stringified `[object Object]`.
- **Mitigation**: Add checks like `if (sicht !== undefined && typeof sicht !== 'string') { return res.status(400).json({ error: 'sicht must be a string' }); }` in `routes.js`.

### [Medium] Challenge 2: Lack of Pagination on GET `/api/dives`
- **Assumption challenged**: The database table size will remain small.
- **Attack scenario**: In production or during stress testing, thousands of dives are logged. Calling GET `/api/dives` pulls all rows from the database in a single query, maps over them, and sends a single massive JSON array response.
- **Blast radius**: Out-of-memory crashes on the NodeJS server, high latency, blocked event loop, and denial of service.
- **Mitigation**: Introduce pagination using `limit` and `offset` query parameters.

### [Low] Challenge 3: Lack of Check for Infinity in Numeric Fields
- **Assumption challenged**: `typeof val === 'number'` and `val >= 0` are sufficient to validate numbers.
- **Attack scenario**: A client sends `Infinity` for `tauchgang_nr`, `dauer_min`, `tiefe_m`, `gewicht_kg`, or `temperatur_c`. Since `typeof Infinity === 'number'` and `Infinity >= 0` are true, it passes validation.
- **Blast radius**: Database exceptions, serialization failure, or storage of incorrect representation.
- **Mitigation**: Use `Number.isFinite(val)` instead of `typeof val === 'number'`.

---

## 1. Observation
- **File Checked**: `backend/src/routes.js`
- **File Checked**: `backend/src/app.js`
- **File Checked**: `backend/src/routes.test.js`
- **Lines of interest**:
  - `backend/src/routes.js:74-85` (Numeric validation):
    ```javascript
    const numericFields = ['tauchgang_nr', 'dauer_min', 'tiefe_m', 'gewicht_kg', 'temperatur_c'];
    for (const field of numericFields) {
      const val = req.body[field];
      if (val !== undefined && val !== null) {
        if (typeof val !== 'number' || Number.isNaN(val)) {
          return res.status(400).json({ error: `${field} must be a number` });
        }
        if (val < 0) {
          return res.status(400).json({ error: `${field} cannot be negative` });
        }
      }
    }
    ```
  - `backend/src/routes.js:100-112` (DB Insertion):
    ```javascript
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
    ```
- **Execution Log**:
  - Attempted to run test suite via `npm test` in the `backend/` directory, but the permission prompt timed out due to the headless nature of the automated environment.

---

## 2. Logic Chain
1. The route handler for `POST /api/dives` validates `ort`, `datum`, `tauchgang_nr`, `dauer_min`, `tiefe_m`, `gewicht_kg`, `temperatur_c`, and `stempel`.
2. However, optional string parameters like `sicht`, `stroemung`, and `unterschrift_partner` are retrieved from the request body but never checked for their datatype.
3. If non-string values (such as nested objects or arrays) are supplied, they are passed down to the SQLite client driver during query binding.
4. Depending on driver version and type mapping, this will either trigger an unhandled error inside the SQL driver (leading to `500 Internal Server Error`) or insert `[object Object]` (polluting database records).
5. For numeric fields, `Infinity` is permitted by the checks, but is not a valid discrete value for dive stats (like dive number or depth).
6. For GET `/api/dives`, the handler calls `getAllDives()` which fetches all rows using `db.all('SELECT * FROM dives ORDER BY id DESC')`. This is not scalable.

---

## 3. Caveats
- Execution of commands was not possible due to automated system permission limits.
- The behavior of the node-sqlite3 binding with objects may vary depending on the underlying OS libraries and module versions (either database pollution or 500 error).

---

## 4. Conclusion
The implementation of the Milestone 3 Backend API is generally complete and correct regarding its basic functional requirements. It handles required inputs and dates well. However, it lacks robust type validation on optional fields and has potential scalability limits under heavy load (lack of pagination).

---

## 5. Verification Method
1. To verify code execution, run:
   ```bash
   npm test
   ```
   inside the `backend/` directory.
2. We added comprehensive test coverage inside `backend/src/routes.test.js` covering:
   - Trailing comma malformed JSON detection (400)
   - SQL Injection safety checks (201, verifying parameterized queries prevent command injection)
   - Leap year and bounds boundary date validations
   - Unexpected types in optional fields (testing robustness of `sicht` objects)
   - Infinity / NaN numeric validation.
