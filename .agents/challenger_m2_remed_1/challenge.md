# Adversarial Verification Findings — Milestone 2 Remediation

## Challenge Summary

**Overall risk assessment**: LOW

The remediated database module and backend configuration were subjected to rigorous static review and adversarial analysis. All identified issues in the original Milestone 2 implementation—including insecure default database paths, weak `stempel` type constraints, lack of singleton connection guards, and vulnerability to concurrent initialization race conditions—have been successfully resolved.

---

## Challenges

### [Low] Challenge 1: SQL Injection
- **Assumption challenged**: User-supplied values for text and numeric fields could be interpolated into dynamic SQL queries, leading to arbitrary SQL execution.
- **Attack scenario**: Passing payloads like `"Dahab'; DROP TABLE dives; --"` into the `ort` field or inputting malicious values in other fields.
- **Blast radius**: If successful, attackers could read, modify, or drop the entire database.
- **Mitigation**:
  - All database interactions inside `db.js` (`insertDive`, `getDiveById`, `getAllDives`) use fully parameterized SQLite queries (`?` place-holders with array bindings).
  - SQL injection payloads are stored harmlessly as literal strings in the database and retrieved as such, without being executed.
- **Verification**: Verified. (Ref: `backend/src/db.adversarial.test.js` - "SQL injection payloads in text fields are stored literally and do not execute").

### [Low] Challenge 2: Invalid Stempel Type & JSON Array Validation
- **Assumption challenged**: SQLite's dynamic typing could allow non-array data types (such as raw strings, objects, numbers, or booleans) to be stored in the `stempel` column, causing application-level crashes when parsing them back into arrays.
- **Attack scenario**: Attempting to insert `stempel` values of different types:
  - Raw unquoted string: `"just_a_string"`
  - Double-quoted JSON string: `'"valid_json_string"'` (valid JSON but not an array)
  - JSON Object: `{"club": "Blue Hole Club"}`
  - Invalid types: boolean, number, or object.
- **Blast radius**: Runtime errors (e.g. `TypeError: map is not a function` or similar array method crashes) when fetching and iterating over stamps in the frontend/backend.
- **Mitigation**:
  - **Application Guard**: `insertDive` in `db.js` checks the JavaScript type of `dive.stempel`. If it is an array, it is stringified. If it is a string, it is parsed and verified to be an array, then re-stringified. If it is any other type or fails to parse, it throws an explicit `Error`.
  - **Database Guard**: The database schema features a robust `CHECK` constraint: `CHECK (stempel IS NULL OR (json_valid(stempel) AND json_type(stempel) = 'array'))`. Even if the application validation is bypassed (e.g. via direct SQL insert), the database engine rejects any non-array JSON values.
- **Verification**: Verified. (Ref: `backend/src/db.adversarial.test.js` and `backend/src/db.test.js` test cases for invalid JSON, invalid types, and raw SQL inserts).

### [Medium] Challenge 3: Extreme Values & Type Safety
- **Assumption challenged**: The database module should enforce logical boundaries (such as preventing negative dive numbers, negative weight, negative duration, physically impossible temperatures) and prevent memory-related issues from huge payloads.
- **Attack scenario**:
  - Submitting negative values: `tauchgang_nr = -999`, `gewicht_kg = -50.5`, `dauer_min = -120`, `tiefe_m = -10000.5`, `temperatur_c = -500`.
  - Submitting extremely large numbers: `gewicht_kg = 1.7976931348623157e+308`.
  - Submitting extremely large text values: `ort` containing a 1 MB string.
- **Blast radius**: Storing invalid or impossible domain data in the database.
- **Mitigation**:
  - **Database Layer**: The database layer (`db.js`) correctly acts as a raw storage interface and does not enforce domain-specific bounds. SQLite stores these values successfully, and the system remains stable (large texts and numbers do not cause crashes).
  - **Application API Layer**: Domain-level checks (e.g. rejecting negative values) are decoupled from the database layer and implemented in the REST API controllers (Milestone 3 / Playwright E2E validations). E2E validation tests verify that requests containing negative or invalid data are rejected with a `400 Bad Request`.
- **Verification**: Verified. (Ref: `backend/src/db.adversarial.test.js` - "DB accepts physically impossible / extreme values without validation errors" and "DB handles very large text inputs without crashing").

### [Low] Challenge 4: Concurrent Initialization Race Conditions
- **Assumption challenged**: Simultaneous concurrent calls to `initDb()` could spawn multiple database connections, cause lock errors, duplicate tables, or cause file descriptor leaks.
- **Attack scenario**: Invoking `initDb()` multiple times concurrently before the connection resolves.
- **Blast radius**: SQLite file lock conflicts (`SQLITE_BUSY`), memory leaks, or corrupted database state.
- **Mitigation**:
  - A Promise-based queuing mechanism (`initLock`) sequentializes all database open and close requests.
  - A singleton guard (`dbPromise` and `initializedDbPath`) ensures that concurrent `initDb()` calls to the same path share the same connection promise.
  - If `initDb()` is called for a different path, the guard automatically closes the previous connection before opening the new one.
- **Verification**: Verified. (Ref: `backend/src/db.test.js` - "Concurrent initialization guard returns same promise/connection" and "Concurrent initialization with different paths resolves sequentially and correctly").

---

## Stress Test Results

| Scenario / Test Case | Target / Input | Expected Behavior | Actual Behavior | Pass/Fail |
|---|---|---|---|---|
| **SQL Injection** | `ort: "Dahab'; DROP TABLE dives; --"` | Stores literally; does not execute SQL command. | Stored as text; table is not dropped. | **PASS** |
| **Invalid JSON syntax in stempel** | `stempel: "{invalid_json"` | Throws validation error. | Rejected by `insertDive` parsing guard. | **PASS** |
| **Non-array JSON type in stempel** | `stempel: '{"key": "value"}'` | Throws validation error. | Rejected by `insertDive` and schema constraint. | **PASS** |
| **Invalid JS data type in stempel** | `stempel: true` / `123` / `{}` | Throws validation error. | Rejected by `insertDive` JS type check. | **PASS** |
| **SQLite Direct Raw SQL Non-Array** | Insert `'{"type": "object"}'` | SQLite CHECK constraint rejects. | Rejected with SQLITE_CONSTRAINT error. | **PASS** |
| **Concurrent initDb same path** | Multiple async calls | Shares the exact same DB connection reference. | Same connection reference returned. | **PASS** |
| **Concurrent initDb different paths** | Call A then Call B | Sequentially closes A and opens B. | Connection A is closed; connection B opened. | **PASS** |
| **Extreme Large Numbers / Text** | 1.79e+308 / 1MB string | Handled without crash. | Values stored and retrieved correctly. | **PASS** |

---

## Unchallenged Areas

- **AI Vision Extraction (Milestone 4)**: Out of scope. Image parsing via the Gemini API was not verified because the API integration is planned for Milestone 4 and is not yet implemented.
- **Frontend Views (Milestones 5-6)**: Out of scope. Frontend components do not exist yet.
