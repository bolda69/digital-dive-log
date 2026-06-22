# Handoff Report — Adversarial Verification of Milestone 2

## 1. Observation

- **Database Table Definition** in `backend/src/db.js` (lines 39–54):
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
  *Observations*:
  - Line 51: `stempel TEXT CHECK (json_valid(stempel))` checks that `stempel` is valid JSON.
  - No `CHECK` constraints exist for logical boundaries or ranges of numeric columns.
  - The table creation statement is not defined with `STRICT` (no `STRICT` table modifier).

- **Data Insertion Logic** in `backend/src/db.js` (lines 81–117):
  No JavaScript-side type validation or sanitization is performed on input properties before execution, except for stringifying objects/arrays passed to `stempel`. Values are bound directly to placeholders in parameterized query.

- **Express Configuration** in `backend/src/app.js` (lines 11–16):
  ```javascript
  app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      return res.status(400).json({ error: 'Malformed JSON' });
    }
    next();
  });
  ```
  *Observation*: Only `SyntaxError` with status 400 is explicitly caught. Other parsing errors (e.g. `PayloadTooLargeError` status 413) are passed to the default handler.

- **Adversarial Test Suite**: Added a new test file `backend/src/db.adversarial.test.js` to check:
  1. SQL Injection (`ort` set to `"Dahab'; DROP TABLE dives; --"`).
  2. stempel column validation (invalid JSON `"hello"` and `"{invalid_json: true"`).
  3. Dynamic typing behavior (inserting `"heavy"` into `gewicht_kg`).
  4. Extreme values (negative duration and temperature below absolute zero).

- **Execution Command and Result**:
  Command proposed: `npm test` in `backend/`.
  Result: Permission prompt timed out twice due to terminal automation environment restrictions:
  `Permission prompt for action 'command' on target 'npm test' timed out waiting for user response.`

---

## 2. Logic Chain

1. **SQL Injection Resistance**: Parameterized inserts are used in `backend/src/db.js` line 102 (`await db.run(query, [...])`). This ensures that string inputs containing SQL payloads (e.g., `' DROP TABLE dives; --`) are stored as literal string values rather than executed as raw SQL.
2. **stempel JSON Check Constraint**: The SQLite schema utilizes `CHECK (json_valid(stempel))` (line 51). If a client passes an invalid JSON string (e.g. `'hello'` or `'{invalid}'`), SQLite's `json_valid` returns 0. The insert fails and throws a database error, preventing malformed JSON strings from entering the DB.
3. **Absence of Type Safety**: SQLite uses dynamic typing. A table column like `gewicht_kg REAL` accepts any type (e.g., a text string like `'heavy'`) if it cannot be parsed as a float. Because `db.js` does not perform application-level type validation and does not use SQLite `STRICT` tables, inserting incorrect types will succeed.
4. **Absence of Range Validation**: The database lacks `CHECK` constraints for numeric ranges (e.g. `gewicht_kg >= 0`). Because no validation is performed in JavaScript, physically impossible values like negative depth/duration/weight or temperatures below absolute zero are successfully written to the database.
5. **Incomplete Body Parser Error Handling**: The Express middleware in `app.js` catches status 400 JSON syntax errors but does not catch status 413 (Payload Too Large) parsing errors, which will be propagated to the default Express handler.

---

## 3. Caveats

- We were unable to execute the Jest test suite dynamically due to terminal permissions timing out in the runner environment.
- The behavior of the database wrapper and Express app was verified by rigorous static analysis of the source code and standard SQLite/Express behaviors.
- The analysis assumes `sqlite3` driver version 5.1.7 uses standard SQLite engine behaviors.

---

## 4. Conclusion

The Milestone 2 backend foundation has robust SQL injection protection and correctly validates the JSON structure of the `stempel` column. However, it is highly vulnerable to type confusion (due to dynamic SQLite typing) and logical data corruption (due to the lack of range/boundary checks on numeric inputs).

**Actionable Recommendations:**
1. Configure schema validations at the application level (e.g. Zod or Joi schemas) in the upcoming API route implementations (Milestone 3).
2. Or, update the SQLite schema to use `STRICT` mode and add column range `CHECK` constraints.

---

## 5. Verification Method

To verify these findings and execute the newly written tests:
1. Navigate to `/home/daniel/IdeaProjects/digital-dive-log/backend`
2. Run:
   ```bash
   npm test
   ```
3. Inspect the outputs of `db.adversarial.test.js`.
4. Confirm that:
   - SQL Injection test passes (safely handled).
   - Invalid JSON `stempel` tests pass (correctly rejected).
   - Invalid type tests "fail" standard assumptions (i.e. SQLite accepts the string `"heavy"` into `gewicht_kg` and stores it as text).
   - Negative value tests "fail" logical validity (i.e. the database accepts negative weight/depth).
