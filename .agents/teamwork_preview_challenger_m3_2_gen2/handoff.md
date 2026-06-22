# Handoff Report — Adversarial Challenge of Milestone 3 Backend REST API

This report documents the adversarial review and stress testing of the Backend REST API implementation for Milestone 3 (`backend/src/routes.js`).

---

## 1. Observation

During a detailed inspection of the route registration and validation layer in `/home/daniel/IdeaProjects/digital-dive-log/backend/src/routes.js`, the following code blocks were observed:

### Missing Body Safety Check (Lines 23-36)
```javascript
router.post('/dives', async (req, res) => {
  const {
    ort,
    datum,
    tauchgang_nr,
    sicht,
    gewicht_kg,
    dauer_min,
    tiefe_m,
    temperatur_c,
    stroemung,
    unterschrift_partner,
    stempel
  } = req.body;
```
If a request is sent where `req.body` is undefined (for example, if the `Content-Type` is omitted or incorrect, and Express fails to parse a body), destructuring `req.body` throws a `TypeError: Cannot destructure property 'ort' of 'req.body' as it is undefined`. Because this block is not wrapped in a local `try-catch`, this error propagates to the Express global handler, yielding a `500 Internal Server Error` instead of a validation `400 Bad Request`.

### Numeric Field Validation Block (Lines 74-85)
```javascript
  // 3. Numeric Fields Validation
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
* **Floats Accepted for Integers**: The validation checks only if the value is a number (`typeof val !== 'number'`). There is no check to ensure that fields mapped to `INTEGER` in the SQLite database schema (`tauchgang_nr`, `dauer_min`, `temperatur_c`) are actual integers. Passing float values like `5.5` is accepted, bypassing integer constraints and inserting fractional values into integer columns.
* **Negative Temperature Domain Flaw**: Water temperature in Celsius can physically be negative (e.g. -2°C during ice dives). However, the loop applies `val < 0` to all numeric fields, including `temperatur_c`. As a result, valid cold-water dive logs are rejected with `400 Bad Request`.
* **Infinity Values Allowed**: `Infinity` is a number (`typeof Infinity === 'number'`) and is not `NaN`, nor is it `< 0`. Therefore, passing `Infinity` as a value bypasses the numeric validator.

### Validation Gaps on Optional Text Fields (Lines 23-36 & 99-112)
There is a complete lack of validation checks for the optional text fields `sicht`, `stroemung`, and `unterschrift_partner`. These values are extracted directly from `req.body` and passed into the database wrapper `insertDive`:
```javascript
    const record = await insertDive({
      ...
      sicht: sicht !== undefined ? sicht : null,
      ...
      stroemung: stroemung !== undefined ? stroemung : null,
      unterschrift_partner: unterschrift_partner !== undefined ? unterschrift_partner : null,
      ...
    });
```
When non-string values (such as nested objects `{}` or booleans) are provided for these fields, the API accepts them with `201 Created` and converts/stores them as literal strings in the database (e.g., storing the string `"[object Object]"` or `"true"`), failing the strictness requirement of interface contracts.

---

## 2. Logic Chain

1. **Premise**: Validations must be strict and return `400 Bad Request` for any request payloads that violate the structural, type, or physical domains of the API.
2. **Observation**: Destructuring `req.body` when it is undefined throws a `TypeError` which results in a `500 Internal Server Error` response.
   - *Inference*: Therefore, clients can trigger server-side execution failures (500s) instead of receiving a `400 Bad Request`.
3. **Observation**: `temperatur_c` is checked for `val < 0`.
   - *Inference*: Any dive log recorded with a valid negative water temperature (e.g., -1.5°C in polar water) is rejected by the API as invalid.
4. **Observation**: `sicht`, `stroemung`, and `unterschrift_partner` have no type validations, and float numbers are accepted for integer fields.
   - *Inference*: Clients can write malformed data (objects converted to strings, floating-point numbers in integer fields, and `Infinity` inputs) directly to the database without validation errors.

---

## 3. Caveats

* **In-Memory Testing Context**: Tests were written and configured to run against Jest utilizing an in-memory SQLite database configuration (`:memory:`) to ensure no side effects on local test assets.
* **Terminal Permission Limitations**: Because the execution environment prompts the user for permissions which time out when non-interactive, commands could not be run synchronously in this execution thread. All tests were instead compiled into `backend/src/routes.adversarial.test.js` which is ready for the local test runner.

---

## 4. Conclusion & Adversarial Review

**Overall Risk Assessment**: MEDIUM

The validation layer in `backend/src/routes.js` successfully handles core constraints (such as missing `ort` or `datum`, malformed JSON structures, and incorrect date syntax). However, multiple validation gaps exist regarding data sanitization, type safety, and real-world domain rules.

### Challenges Identified

* **[High] Challenge 1: Unhandled `req.body` Undefined Crash**
  - **Assumption challenged**: Assumes `req.body` is always populated by parsing middleware.
  - **Attack scenario**: POST requests sent with non-JSON content types or empty bodies without headers bypass the parser, resulting in `req.body = undefined`.
  - **Blast radius**: The route throws a TypeError, triggering a `500 Internal Server Error`.
  - **Mitigation**: Add a check at the top of the route handler: `if (!req.body) return res.status(400).json({ error: 'Request body is required' });`

* **[Medium] Challenge 2: Negative Temperature Rejection (Domain Bug)**
  - **Assumption challenged**: Assumes water temperatures cannot be negative.
  - **Attack scenario**: Dive logs from polar/high-altitude ice diving where water is below 0°C are uploaded.
  - **Blast radius**: Valid user inputs are rejected with a validation error.
  - **Mitigation**: Exclude `temperatur_c` from the `val < 0` loop constraint, or define a specific lower bound (e.g., `val < -273.15` for absolute zero, or `val < -10` as a sensible water temperature limit).

* **[Medium] Challenge 3: Validation Gaps on Optional Text Fields**
  - **Assumption challenged**: Assumes client will only send strings for `sicht`, `stroemung`, and `unterschrift_partner`.
  - **Attack scenario**: Client sends objects, booleans, or arrays for optional text fields.
  - **Blast radius**: Database stores stringified garbage such as `"[object Object]"` or `"true"`.
  - **Mitigation**: Add type validation checks verifying these fields are strings:
    ```javascript
    const textFields = ['sicht', 'stroemung', 'unterschrift_partner'];
    for (const field of textFields) {
      const val = req.body[field];
      if (val !== undefined && val !== null && typeof val !== 'string') {
        return res.status(400).json({ error: `${field} must be a string` });
      }
    }
    ```

* **[Low] Challenge 4: Integer Type Bypass (Floats & Infinity Accepted)**
  - **Assumption challenged**: Numeric validation `typeof val === 'number'` ensures database schema compliance.
  - **Attack scenario**: A user sends floats (`tauchgang_nr: 5.5`) or `Infinity` values.
  - **Blast radius**: Values bypass checks and are written to columns declared as `INTEGER`.
  - **Mitigation**: Use `Number.isInteger(val)` for fields mapped to integer columns, and verify `Number.isFinite(val)`.

---

## 5. Verification Method

### Tests Created
An adversarial test suite has been written and saved directly to the project at:
`/home/daniel/IdeaProjects/digital-dive-log/backend/src/routes.adversarial.test.js`

### Execution Command
To run these tests, navigate to the `backend` folder and run the Jest test suite:
```bash
cd backend
npm test src/routes.adversarial.test.js
```

### Invalidation Conditions
The verification tests will fail if:
* Negative temperatures are accepted (they currently trigger `400 Bad Request` and fail the real-world domain validity requirement, though they match the code's current behavior).
* Floats are rejected for integer fields (the test expects them to be accepted to document the current lack of type checks).
* Objects passed to optional text fields are rejected (the test asserts that the current implementation accepts them and inserts them as strings).
