# Handoff Report — Challenger M2

## 1. Observation
- **File Paths Investigated**:
  - `backend/src/db.js` (lines 38-54, schema definition; lines 81-117, insert helper; lines 124-138, query helper).
  - `backend/src/app.js` (lines 10-16, malformed JSON middleware; lines 18-21, health endpoint).
- **Verbatim DB Schema (`backend/src/db.js` lines 38-54)**:
  ```javascript
  await db.exec(`
    CREATE TABLE IF NOT EXISTS dives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tauchgang_nr INTEGER,
      ort TEXT,
      datum TEXT,
      sicht TEXT,
      gewicht_kg REAL,
      dauer_min INTEGER,
      tiefe_m REAL,
      temperatur_c INTEGER,
      stroemung TEXT,
      unterschrift_partner TEXT,
      stempel TEXT CHECK (json_valid(stempel)),
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    )
  `);
  ```
- **Verbatim Express Handler (`backend/src/app.js` lines 10-16)**:
  ```javascript
  // Handle malformed JSON input gracefully
  app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      return res.status(400).json({ error: 'Malformed JSON' });
    }
    next();
  });
  ```
- **New Test Files Created**:
  - `backend/src/db.adversarial.test.js`
  - `backend/src/app.adversarial.test.js`
- **Command Output**:
  - `run_command` of `npm test` timed out waiting for user approval.

## 2. Logic Chain
- **SQL Injection Safety**: `db.js` uses parameterized query placeholder binding (`?`) in both `insertDive` and `getDiveById`. Parameterized query bindings prevent user strings from escaping raw SQL parsing. Therefore, SQL Injection attacks are successfully mitigated at the database layer.
- **Dynamic Type Vulnerability**: SQLite's dynamic type affinity (manifest typing) does not restrict inserting values of mismatched types (e.g. text `'abc'` in integer column `tauchgang_nr`) unless a column is defined as `STRICT` or has type `CHECK` constraints. Because the `dives` table does not use `STRICT` tables and the database wrapper does not perform JavaScript-level type validations prior to executing the insert query, it is possible to write invalid types directly into the database.
- **Missing Range Constraints**: Columns like `tauchgang_nr`, `gewicht_kg`, `dauer_min`, and `tiefe_m` naturally represent non-negative quantities, but they have no schema-level range check constraints (e.g., `CHECK (dauer_min > 0)`). This exposes the database to storing logically corrupt data if the validation layer in Express has an oversight or is bypassed.
- **API Error Response Violation**: Express's default JSON body parser limits payloads to 100kb and throws a `413 Payload Too Large` error on overflow. The error handler in `app.js` only catches `SyntaxError` with status `400`. Because 413 or 500 errors bypass this middleware and are not caught by other handlers, Express defaults to responding with HTML pages rather than the JSON object format required by the REST API contract.

## 3. Caveats
- Command executions (`npm test`) were not approved by the user, so execution-based validation reports are absent. Verification depends on the static code analysis and logic path tracing outlined.
- Milestone 2 does not implement the actual CRUD controllers and routers. Therefore, verification of endpoint route parameters and validation mechanisms is deferred until Milestone 3.

## 4. Conclusion
The backend DB wrapper and Express configuration of Milestone 2 are **secure against SQL injection**, but **lack database-level type and range validation constraints**. Additionally, the Express configuration does not guarantee JSON error format compliance for non-400 errors (like `413 Payload Too Large`).

## 5. Verification Method
To verify these behaviors once the test environment is available:
1. Navigate to `backend/` and run the tests:
   ```bash
   npm test
   ```
2. Verify that the new adversarial tests pass, which confirms:
   - SQL Injection strings are stored as plain text.
   - SQLite allows inserting text values in numerical columns (`tauchgang_nr`).
   - `413 Payload Too Large` error returns Express's default HTML response.
3. Invalidation condition: If the database is updated to use SQLite `STRICT` tables or explicit constraints, the test `'SQLite dynamic typing allows storing string in INTEGER column'` in `backend/src/db.adversarial.test.js` will fail (which is the desired long-term design).
