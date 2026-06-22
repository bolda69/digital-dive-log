## Challenge Summary

**Overall risk assessment**: MEDIUM

While the application utilizes parameterized queries that prevent SQL injection attacks, it relies entirely on the application validation layer (implemented in the mock server for tests and planned for the real routes in Milestone 3) to enforce type safety, non-negativity, and correct formats. The database layer itself lacks strict type enforcement, numerical range constraints, and date validity checks. In addition, the Express server's error handling for non-400 errors (like 413 Payload Too Large) will default to HTML responses, violating the JSON API contract.

---

## Challenges

### [Medium] Challenge 1: Lax Database Type Constraints (SQLite Dynamic Typing)

- **Assumption challenged**: The SQLite database schema enforces that `tauchgang_nr` contains integers, `gewicht_kg` contains reals, etc.
- **Attack scenario**: If the validation layer in Express is bypassed or has a bug, or if data is inserted via secondary scripts/migrations, any type (like a string `'abc'`) can be written into numerical columns (like `tauchgang_nr`).
- **Blast radius**: Storing strings in numerical fields will break frontend consumers expecting numbers, and could lead to silent errors or arithmetic failures in calculations.
- **Mitigation**: Enable SQLite's `STRICT` table mode (introduced in SQLite 3.37.0) by defining the table as `CREATE TABLE IF NOT EXISTS dives (...) STRICT;`, or add explicit type check constraints like `CHECK (typeof(tauchgang_nr) = 'integer' OR tauchgang_nr IS NULL)`.

### [Medium] Challenge 2: No Database-Level Range Constraints (Negative Values)

- **Assumption challenged**: Numerical values such as dive number, weight, duration, depth, and temperature cannot be negative.
- **Attack scenario**: An attacker bypasses application-level verification or exploits an unvalidated endpoint parameter to insert negative values (e.g., `dauer_min = -100`, `tiefe_m = -40`).
- **Blast radius**: The database happily stores negative numbers. This leads to data corruption, logical anomalies in dive logs, and potentially breaks UI rendering or statistics.
- **Mitigation**: Add database-level check constraints to numerical columns in `db.js`:
  ```sql
  CHECK (tauchgang_nr IS NULL OR tauchgang_nr > 0)
  CHECK (gewicht_kg IS NULL OR gewicht_kg >= 0)
  CHECK (dauer_min IS NULL OR dauer_min > 0)
  CHECK (tiefe_m IS NULL OR tiefe_m >= 0)
  ```

### [Low] Challenge 3: No Database-Level Format/Calendar Check for Dates

- **Assumption challenged**: The `datum` field always contains a valid YYYY-MM-DD calendar date.
- **Attack scenario**: An invalid date string (e.g., `"2026-02-31"` or `"not-a-date"`) is written directly or via validation bypass to the `datum` column.
- **Blast radius**: The database stores invalid dates without error, which will break subsequent date filtering, sorting, or calendar rendering in the frontend.
- **Mitigation**: Enforce date format verification in the SQLite database schema:
  ```sql
  CHECK (datum IS NULL OR (length(datum) = 10 AND date(datum) IS NOT NULL))
  ```

### [Low] Challenge 4: API Contract Violation on Express Error Handling

- **Assumption challenged**: The API will always return a structured JSON response `{ "error": "message" }` for all client or server-side errors.
- **Attack scenario**: A client uploads a payload exceeding 100kb, triggering a `413 Payload Too Large` error, or a server-side runtime error (500) occurs.
- **Blast radius**: The custom JSON error handler in `app.js` only catches `SyntaxError` with status 400. Other errors (like 413 or 500) bypass it and trigger Express's default HTML error page, violating the JSON API contract.
- **Mitigation**: Add a catch-all JSON error handling middleware at the end of `app.js`:
  ```javascript
  app.use((err, req, res, next) => {
    const status = err.status || 500;
    const message = err.message || 'Internal Server Error';
    res.status(status).json({ error: message });
  });
  ```

### [Low] Challenge 5: `stempel` Column Empty String Exception

- **Assumption challenged**: The database constraint `CHECK (json_valid(stempel))` handles all invalid inputs safely.
- **Attack scenario**: A user or API client passes an empty string `""` as the `stempel` value. `insertDive` does not serialize it (as it is not an object) and passes `""` directly to the SQL query.
- **Blast radius**: SQLite's `json_valid("")` returns `0` (false) since an empty string is not a valid JSON document. The database throws a constraint exception, leading to an unhandled promise rejection if not caught.
- **Mitigation**: Ensure `insertDive` checks if `dive.stempel` is an empty string and converts it to `null` or a valid empty JSON array `'[]'`.

---

## Stress Test Results

We have written adversarial test files in the codebase to capture these behaviors:
- `backend/src/db.adversarial.test.js`: Validates SQL injection immunity (PASS due to parameterized queries), verifies the `stempel` JSON constraint (PASS), and confirms SQLite dynamic typing allows inserting strings in integer columns (PASS/Vulnerability confirmed).
- `backend/src/app.adversarial.test.js`: Validates JSON syntax error handling (PASS), CORS preflight headers (PASS), and verifies the 413 payload limit fallback (PASS/HTML response vulnerability confirmed).

---

## Unchallenged Areas

- **AI Vision OCR Extraction**: Cannot be challenged at this stage because the actual Gemini API communication module (`gemini.js`) is planned for Milestone 4 and is currently only simulated.
- **CRUD Endpoints (Milestone 3)**: The real `/api/dives` and `/api/upload` endpoint implementation code is out of scope for Milestone 2 and is currently simulated only via `e2e/mock-server.js`.
