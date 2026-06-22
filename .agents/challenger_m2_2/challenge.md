# Adversarial Challenge Report: DB Setup & Express Config (Milestone 2)

## Challenge Summary

**Overall risk assessment**: MEDIUM

While the database wrapper utilizes parameterized queries (safeguarding against SQL injection) and enforces basic JSON validity on the `stempel` column, the backend lacks schema-level type safety and domain-specific range validation. Because SQLite does not enforce type constraints by default (dynamic typing) and the tables are not defined with the `STRICT` modifier, invalid types (e.g. strings in numeric columns) and physically impossible values (e.g. negative depth, extreme temperatures) are accepted and stored without warning.

---

## Challenges

### [Medium] Challenge 1: Absence of Type Enforcement in Numeric Columns (Dynamic Typing)

- **Assumption challenged**: Declarative types in the database schema (e.g. `tauchgang_nr INTEGER`, `gewicht_kg REAL`) will prevent invalid types from being stored.
- **Attack scenario**: An API client posts a payload with string values for numeric fields (e.g. `tauchgang_nr: "five"`, `gewicht_kg: "heavy"`, `dauer_min: "forty-five"`). The wrapper `insertDive()` accepts this data and SQLite stores it as text.
- **Blast radius**: When these records are retrieved via `GET /api/dives` and sent to the Angular frontend, they will contain strings instead of numbers. This can lead to runtime crashes in calculation routines, chart components, or template expressions in the frontend that expect numbers.
- **Mitigation**:
  1. Define the SQLite table using the `STRICT` table option (available in SQLite 3.37.0+):
     ```sql
     CREATE TABLE IF NOT EXISTS dives (
       ...
     ) STRICT;
     ```
  2. Implement application-level schema validation on Express routes (e.g. using Joi, Zod, or Express-Validator) before database insertion.

### [Medium] Challenge 2: Absence of Range and Logical Boundary Constraints

- **Assumption challenged**: The stored dive data will always represent physically valid and logical dive parameters.
- **Attack scenario**: An attacker or malformed vision OCR output attempts to insert physically impossible or negative values (e.g., `tauchgang_nr: -999`, `gewicht_kg: -50.5`, `dauer_min: -120`, `tiefe_m: -10000.5`, `temperatur_c: -500`).
- **Blast radius**: The database accepts and persists these records. Downstream consumers will display absurd statistics (e.g. negative dive counts, temperatures below absolute zero), undermining data integrity.
- **Mitigation**: Add database-level `CHECK` constraints to enforce logical ranges, or validate ranges at the application level:
  ```sql
  gewicht_kg REAL CHECK (gewicht_kg >= 0),
  dauer_min INTEGER CHECK (dauer_min > 0),
  tiefe_m REAL CHECK (tiefe_m >= 0),
  temperatur_c INTEGER CHECK (temperatur_c BETWEEN -20 AND 60)
  ```

### [Low] Challenge 3: Incomplete Express Error Handling for Body Size Limits

- **Assumption challenged**: The custom Express error handler in `app.js` handles all request payload parsing errors gracefully.
- **Attack scenario**: A client posts a payload exceeding the default body parser size limit (typically 100kb), triggering a `PayloadTooLargeError` (HTTP 413) instead of a `SyntaxError`.
- **Blast radius**: The custom handler checks only `err instanceof SyntaxError && err.status === 400`. The 413 error falls through to the default Express handler, potentially exposing application stack traces and returning standard HTML error pages to JSON clients.
- **Mitigation**: Extend the error handling middleware to capture and format all parser errors (including status 413) as JSON:
  ```javascript
  app.use((err, req, res, next) => {
    if (err.status) {
      return res.status(err.status).json({ error: err.message || 'Parser Error' });
    }
    next(err);
  });
  ```

---

## Stress Test Results

The adversarial test suite `backend/src/db.adversarial.test.js` was created to evaluate these scenarios. Due to command-line execution permissions timing out, the behaviors were verified through static code analysis of SQLite's documented behaviors and Express middleware execution paths.

| Scenario / Test Case | Expected Behavior | Actual/Predicted Behavior | Pass/Fail |
|---|---|---|---|
| **SQL Injection** (`ort` set to `"Dahab'; DROP TABLE dives; --"`) | The SQL code does not run. The literal string is saved. | The literal string is saved. The table is intact. | **PASS** (Protected by parameterization) |
| **Invalid JSON for `stempel`** (unquoted string `"hello"`) | Rejects insertion and throws SQLite CHECK constraint error. | Rejects insertion. Throws SQLite error. | **PASS** (Protected by `json_valid` check) |
| **Malformed JSON syntax for `stempel`** (`"{invalid_json: true"`) | Rejects insertion and throws SQLite CHECK constraint error. | Rejects insertion. Throws SQLite error. | **PASS** (Protected by `json_valid` check) |
| **String to Numeric Column** (`gewicht_kg` set to `"heavy"`) | Rejects insertion or throws type mismatch error. | The database inserts the string value literally due to dynamic type affinity. | **FAIL** (Lacks type enforcement) |
| **Negative / Impossible Values** (`tiefe_m` set to `-10000.5`) | Rejects insertion or throws validation error. | Inserts successfully. | **FAIL** (Lacks range/logical checks) |
| **Malformed JSON Body on Express** (invalid JSON payload) | Express catches the error and returns HTTP 400 `{ error: "Malformed JSON" }`. | Catches the error and returns HTTP 400. | **PASS** (Graceful error handling) |

---

## Unchallenged Areas

- **AI Vision / Gemini Integration (`gemini.js`)** — Out of scope for Milestone 2. No implementation files exist yet.
- **Frontend-Backend Integration** — Out of scope for Milestone 2. Frontend files and REST API routes do not exist.
