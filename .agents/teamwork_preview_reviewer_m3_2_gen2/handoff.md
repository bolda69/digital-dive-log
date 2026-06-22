# Handoff Report — Milestone 3 Backend REST API Review

## 1. Observation

- **Backend Entry & App Setup**: 
  - `backend/src/app.js` loads Express and CORS, sets up `express.json()` parser middleware, defines a health check, and mounts the router on `/api` (lines 1-27).
  - It contains a custom error handler for malformed JSON parsing errors on lines 12-17:
    ```javascript
    app.use((err, req, res, next) => {
      if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ error: 'Malformed JSON' });
      }
      next();
    });
    ```
- **REST API Routes**:
  - `backend/src/routes.js` exposes `GET /dives`, `POST /dives`, and a conditional testing utility `POST /mock/reset` when `process.env.NODE_ENV === 'test'` (lines 1-162).
  - Required fields `ort` and `datum` are checked for presence and non-emptiness (lines 38-51).
  - Dates are verified using regex `/^\d{4}-\d{2}-\d{2}$/` followed by custom calendar days-in-month boundary verification (lines 53-71).
  - Numeric fields validation is done inside a loop on lines 74-85:
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
  - Optional fields `sicht`, `stroemung`, and `unterschrift_partner` are bound to queries (lines 100-112) but have no validation in the controller layer.
- **Unit & Integration Tests**:
  - Extensive tests exist in `backend/src/routes.test.js`, `backend/src/app.test.js`, `backend/src/app.adversarial.test.js`, `backend/src/db.test.js`, `backend/src/db.adversarial.test.js`, and `backend/src/verify-adversarial.js`.
  - Terminal test command execution (`npm test`) was attempted but timed out waiting for user approval prompt in the non-interactive agent terminal environment.

---

## 2. Logic Chain

- **Error-Swallowing Vulnerability**:
  - In `backend/src/app.js:16`, calling `next()` instead of `next(err)` for non-JSON SyntaxErrors means that other parsing errors (such as `413 Payload Too Large` from `express.json()` limits) bypass the error state. Express resumes normal execution down the middleware chain with an unparsed body, which leads to unexpected outcomes.
- **Domain Constraint Defect**:
  - In `backend/src/routes.js:81`, `val < 0` validates that `temperatur_c` cannot be negative. However, water and air temperatures in polar/ice diving can be negative (e.g. -2°C in salt water). The constraint incorrectly blocks valid real-world dive logs.
- **Dynamic Typing Schema Bypass**:
  - Because `sicht`, `stroemung`, and `unterschrift_partner` are not validated in `routes.js`, SQLite accepts invalid JSON/JS structures (booleans, objects) for TEXT columns, which risks causing downstream parser crashes on the client side.

---

## 3. Caveats

- Direct unit test execution outputs were not captureable due to interactive terminal permission timeout. The tests were instead verified by checking their syntax and logical definitions inside `backend/src/routes.test.js` and other test files.
- E2E tests inside `e2e/api.spec.js` cover `/api/upload` (part of Milestone 4), which is not yet present on the current Milestone 3 backend routing. This is expected.

---

## 4. Conclusion & Verdict

**Verdict**: REQUEST_CHANGES

The implementation of the Milestone 3 backend REST API matches the expected CRUD behavior in terms of database interaction and baseline unit/adversarial testing. However, the Express error handling bug (swallowing errors with `next()`) and overly restrictive temperature validation (rejecting negative Celsius values) must be fixed before proceeding to Milestone 4.

---

## Quality Review Report

### Review Summary

- **Verdict**: REQUEST_CHANGES
- **Rationale**: The core REST API CRUD functionalities are implemented cleanly, but a major error handling flaw and a physical dive domain validation bug require rectification.

### Findings

#### [Major] Finding 1: Error Swallowing in App-Level Error Handler
- **What**: The error handler middleware calls `next()` instead of `next(err)` for unhandled errors.
- **Where**: `backend/src/app.js` lines 12-17
- **Why**: Non-SyntaxError failures (e.g. `413 Payload Too Large` when request size exceeds the limits) are swallowed, letting requests slip into downstream routing as if they were successful.
- **Suggestion**: Change `next();` on line 16 to `next(err);`.

#### [Major] Finding 2: Over-restrictive Negative Temperature Validation
- **What**: The API validation rejects negative numbers for `temperatur_c`.
- **Where**: `backend/src/routes.js` lines 74-85
- **Why**: Ice diving frequently takes place in sub-zero water temperatures (e.g., salt water down to -2°C). Forcing `temperatur_c >= 0` is functionally incorrect.
- **Suggestion**: Exclude `temperatur_c` from the `val < 0` loop check, and validate it separately (e.g., ensuring `val >= -273.15` and matches realistic limits).

#### [Minor] Finding 3: Missing Input Validation on Optional Fields
- **What**: Optional fields `sicht`, `stroemung`, and `unterschrift_partner` are not type-checked.
- **Where**: `backend/src/routes.js` lines 23-119
- **Why**: Non-string values (such as booleans, arrays, or objects) can be sent by malicious/malformed requests and will be directly written into the SQLite database.
- **Suggestion**: Add a check to verify that if these fields are provided, they must be strings.

### Verified Claims

- **Dives Retrieval (GET /api/dives)** → verified via code inspection of `routes.js:9-17` and `routes.test.js:21-30` → **PASS**
- **Dive Insertion (POST /api/dives)** → verified via code inspection of `routes.js:23-119` and `routes.test.js:32-164` → **PASS**
- **Graceful malformed JSON Handling** → verified via code inspection of `app.js:12-17` and `app.test.js:16-23` → **PASS**

### Coverage Gaps

- **Optional Fields Sanitization** — risk level: low/medium — recommendation: check that `sicht`, `stroemung`, and `unterschrift_partner` are strings.

### Unverified Items

- **Terminal Unit Test Output** — Reason: Command permission timed out.

---

## Adversarial Review Report

### Challenge Summary

- **Overall risk assessment**: MEDIUM
- **Rationale**: Swallowed errors can lead to unexpected behaviors for extremely large payloads or database driver crashes, bypassing Express's safety nets.

### Challenges

#### [High] Challenge 1: Error Swallowing Bypassing Express Request Limiting
- **Assumption challenged**: Express middleware limits payloads and correctly responds with `413 Payload Too Large`.
- **Attack scenario**: A client sends a 150KB JSON body (exceeding the default 100KB body-parser limit). Express throws a 413 error. The custom handler catches it, fails the `SyntaxError` check, and calls `next()`. The client does not receive the 413 error directly from body-parser, and the connection remains open or executes route handlers.
- **Blast radius**: Increased memory consumption and DOS potential on endpoints trying to bind values.
- **Mitigation**: Change `next()` to `next(err)` in the error handler.

#### [Medium] Challenge 2: Client Crash via Dynamic Typing
- **Assumption challenged**: SQLite database text columns contain only strings.
- **Attack scenario**: An adversary POSTs a dive with `sicht: true` and `unterschrift_partner: { key: "value" }`. SQLite accepts the insert. When the list is loaded, the client app crashes trying to perform string operations on these values.
- **Blast radius**: UI crash on the frontend list component.
- **Mitigation**: Validate type of optional string inputs.

---

## 5. Verification Method

To verify the fixes independently:
1. Update `backend/src/app.js` to use `next(err)` instead of `next()`.
2. Update `backend/src/routes.js` to permit negative values for `temperatur_c` (while keeping them numeric).
3. Run the unit test suite inside the `backend/` directory:
   ```bash
   npm test
   ```
4. Verify that all test cases (including the adversarial ones) run successfully and pass.
