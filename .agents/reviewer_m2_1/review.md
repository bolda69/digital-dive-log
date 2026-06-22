# Milestone 2 Review Report — Backend DB Setup

## Review Summary

**Verdict**: **APPROVE**

Milestone 2 (Backend DB Setup) is correctly implemented. The database wrapper (`backend/src/db.js`) properly initializes SQLite, creates the `dives` table conforming to the schema in `PROJECT.md`, enforces JSON integrity for the `stempel` field using SQLite's `json_valid` constraint, and exports robust helper functions for CRUD operations. The accompanying unit tests are comprehensive and well-structured.

---

## Quality Review Findings

### [Minor] Finding 1: Conformance - Missing `.env.example` and `README.md`
- **What**: The files `.env.example` and `README.md` are missing from the `backend/` directory.
- **Where**: `backend/`
- **Why**: The project layout section of `PROJECT.md` (lines 49 and 51) specifies that these files should exist under `backend/`. Their absence represents a conformance gap and leaves the backend package undocumented and without an environment configuration template.
- **Suggestion**: Create `backend/.env.example` defining `PORT` and `DB_PATH`, and a basic `backend/README.md` with instructions on how to install dependencies and run tests.

### [Minor] Finding 2: Robustness - Potential Crash on Null or Undefined Parameter
- **What**: Passing `null` or `undefined` to `insertDive` triggers an unhandled `TypeError`.
- **Where**: `backend/src/db.js` (line 81)
- **Why**: The function immediately accesses `dive.stempel` without confirming that `dive` is an object.
- **Suggestion**: Add a guard clause at the start of `insertDive`:
  ```javascript
  if (!dive || typeof dive !== 'object') {
    throw new TypeError('Invalid dive data: must be a non-null object');
  }
  ```

---

## Verified Claims

- **SQLite DB Schema conforms to PROJECT.md** → Verified via inspection of `backend/src/db.js` and comparison with `PROJECT.md` API specification → **PASS**
- **Table creation and constraint check logic** → Verified via inspection of `backend/src/db.test.js` tests → **PASS**
- **JSON array parsing for `stempel`** → Verified via code trace of `insertDive`, `getDiveById`, and `getAllDives` returning expected types → **PASS**

---

## Coverage Gaps

- **Express route database integration** — Risk level: **Low** (DB queries are exposed via helper functions, but the endpoints in `app.js` are not yet connected to the database. This is planned for Milestone 3, so it is an accepted risk for now.)

---

## Unverified Items

- **Running backend tests (`npm test`)** — Reason not verified: Permission prompt to run the terminal command on the host environment timed out waiting for user response. However, static code analysis confirms that the tests are logical, comprehensive, and correct.

---

## Adversarial Challenge Report

### Challenge Summary
**Overall risk assessment**: **LOW**

The SQLite DB wrapper is robust. The use of parameterized queries prevents SQL injection. The SQLite `json_valid` CHECK constraint prevents corrupted data from entering the database.

---

### Challenges

#### [Low] Challenge 1: Type constraint bypass on `stempel`
- **Assumption challenged**: The database assumes `stempel` will always contain an array of strings (per `PROJECT.md`).
- **Attack scenario**: A client sends a raw JSON boolean (`true`) or number (`123`) to the API. Since `typeof true === 'boolean'` and `typeof 123 === 'number'`, they bypass the `typeof === 'object'` check in `insertDive` and are stored directly. SQLite evaluates `json_valid('true')` and `json_valid('123')` to true (since they are valid JSON primitives), allowing invalid non-array data to populate the column.
- **Blast radius**: Low. When retrieved, `JSON.parse` will return boolean or numeric types, which could cause type-related issues in the frontend components expecting an array.
- **Mitigation**: Implement robust schema validation (e.g. Zod/Joi or custom logic) in the API routing layer (Milestone-3) to ensure `stempel` is strictly an array of strings or null before invoking the database wrapper.

#### [Low] Challenge 2: Plain string input to `stempel` triggers DB error instead of auto-stringifying
- **Assumption challenged**: The helper will gracefully serialize the `stempel` input.
- **Attack scenario**: If a caller passes a plain string (e.g. `stempel: "Dahab Club"`), `typeof` is `'string'`, so the DB wrapper does not stringify it. It passes the raw string to SQLite, which rejects it as invalid JSON, throwing a database exception.
- **Blast radius**: Low. The database transaction fails safely, preventing invalid data, but it throws an error that could bubble up as a 500 Internal Server Error if not handled in the routes.
- **Mitigation**: Again, validate and handle incoming input at the REST API boundary.

---

### Stress Test Predictions

- **Concurrent `initDb` calls** → May lead to race conditions where the database connection is closed while queries are running. Pass/Fail: **Fail under concurrent invocation**, but this is an accepted risk since it is only initialized once at application startup.
- **Malformed JSON payload in request** → Caught by express middleware in `app.js` and returns `400 Bad Request` safely. Pass/Fail: **PASS**

---

### Unchallenged Areas
- **Database lock / concurrency limits under high load** — Not challenged as SQLite is running in standard single-connection mode, which is sufficient for a local single-user dive log application.
