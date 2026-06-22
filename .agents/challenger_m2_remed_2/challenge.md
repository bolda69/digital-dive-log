# Challenge Report — 2026-06-21T21:17:00Z

## Challenge Summary

**Overall risk assessment**: LOW

The remediated Milestone 2 backend implementation is highly resilient. It successfully prevents SQL injection through query parameter binding, enforces strict column schemas at both the application and database check-constraint levels for the JSON-based `stempel` field, guarantees singleton database access with sequential queueing, and resolves path resolution inconsistencies to prevent split-brain databases.

---

## Attack Surface

### Hypotheses Tested
1. **SQL Injection**: Attempted to inject malicious SQL syntax (`Dahab'; DROP TABLE dives; --`) into the text fields of the database wrapper to see if it executes or corrupts the schema.
2. **Invalid stempel types**: Sent raw values (boolean, numbers, objects) to `stempel` via the application layer `insertDive` method to verify application-level guards.
3. **Invalid JSON arrays**: Sent malformed JSON strings (`"{invalid_json"`) and valid JSON objects that are not arrays (`'{"key": "value"}'`) to `stempel` via both application layer `insertDive` and raw SQL statements to check database check constraints.
4. **Concurrent Initialization**: Invoked `initDb` multiple times concurrently with both identical and differing database paths to check for database connection overwrites, connection leaks, or split-brain handles.
5. **Extreme Values**: Evaluated how negative numbers (depth, weight, temperature, dive number) are handled by the database layer vs. the REST API validation layer.

### Vulnerabilities Found
- No critical vulnerabilities found in the remediated implementation. The database layer stores extreme/negative values without native database constraints, but these are successfully guarded at the API/endpoint layer in `e2e/mock-server.js`.

### Untested Angles
- Long-term database concurrency and locking under heavy load (e.g. 100+ concurrent writes to a SQLite file). SQLite natively uses database-level locks, so concurrent writes are serialized by SQLite itself, but this was not stress-tested in memory.

---

## Challenges

### [Low] Challenge 1: Absence of Numeric Range Constraints at Database Schema Level
- **Assumption challenged**: The database schema itself guarantees that numbers like dive count, depth, and weight cannot be negative.
- **Attack scenario**: If a direct SQLite connection bypasses the REST API validation layer (e.g., through a maintenance script, admin tool, or future direct database writer), it can insert logically invalid records, such as a dive with a depth of `-1000m` or a temperature of `-500C`.
- **Blast radius**: Low. The REST API serves as the primary gateway and successfully rejects these inputs. However, database data integrity is not fully self-contained.
- **Mitigation**: Add SQLite `CHECK` constraints on the numeric columns in `db.js` (e.g. `tauchgang_nr >= 0`, `gewicht_kg >= 0`, `dauer_min >= 0`, `tiefe_m >= 0`, `temperatur_c >= -273.15`).

### [Low] Challenge 2: stempel Validation Format Normalization
- **Assumption challenged**: The `stempel` JSON array is guaranteed to contain only strings or a specific format (e.g. stamp location, timestamp).
- **Attack scenario**: Passing a valid JSON array of numbers, booleans, or nested objects (e.g. `[123, true, {"nested": "value"}]`) will pass the `json_type(stempel) = 'array'` check at database level, and the `Array.isArray()` check at the JS level.
- **Blast radius**: Low. The system stores the nested structures, but if the client-side/frontend code expects only strings in the stamp array, it could cause UI errors when rendering the stamps.
- **Mitigation**: Add a validation step in `db.js` inside `insertDive` or in the API schema validation layer to verify that every item in the `stempel` array is indeed a string.

---

## Stress Test Results

- **SQL Injection Payload Insertion** → Malicious string stored literally → Malicious string retrieved exactly; schema unharmed → **PASS**
- **Non-array JSON String for `stempel`** → Application rejects insertion with error → Insertion rejected; database throws error → **PASS**
- **JSON Object String for `stempel` via raw SQL** → SQLite `CHECK` constraint rejects insertion → SQL error thrown; write rejected → **PASS**
- **Invalid JS data types (Boolean, Number, Object) for `stempel`** → Application throws type verification error → Errors thrown correctly → **PASS**
- **Concurrent `initDb()` on same path** → Both calls resolve to the same database connection promise → Single database connection shared → **PASS**
- **Concurrent `initDb()` on differing paths** → Sequence is serialized; previous database is closed before opening the new one → Database handles resolved sequentially; no leaks or locks → **PASS**
- **Negative numeric fields via API endpoint (`/api/dives`)** → Endpoint rejects payload with `400 Bad Request` → Endpoint returns 400 with error detail → **PASS**
- **Invalid date formats and calendar dates via API endpoint** → Endpoint rejects format or invalid dates (e.g. Feb 30th) with `400 Bad Request` → Endpoint returns 400 → **PASS**

---

## Unchallenged Areas

- **Gemini API Integration** — Reason not challenged: Out of scope for Milestone 2.
- **Frontend Views & Angular State** — Reason not challenged: Out of scope for Milestone 2.
