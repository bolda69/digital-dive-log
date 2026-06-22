# Backend REST API Endpoint Design Handoff - Milestone 3

This report provides the analysis and design recommendations for implementing `GET /api/dives` and `POST /api/dives` in the `digital-dive-log` project.

---

## 1. Observation

During the read-only exploration of the codebase, the following artifacts and behaviors were observed:

### Database Layer (`backend/src/db.js`)
* **Methods**: The database wrapper exposes helper methods for retrieving and inserting dives:
  * `insertDive(dive)` (Lines 131–177) wraps SQL inserts, stringifying the `stempel` field if it is an array or valid JSON string.
  * `getAllDives()` (Lines 204–220) executes `SELECT * FROM dives ORDER BY id DESC` and maps rows, parsing `stempel` back into a JavaScript array.
* **Typing Constraint**: SQLite uses dynamic typing. As observed in `backend/src/db.adversarial.test.js` (Lines 83–109) and `backend/src/verify-adversarial.js` (Lines 120–136), SQLite does not enforce type check bounds on columns (e.g. text inputs can be stored in real/integer fields like `gewicht_kg` and negative values are saved without validation errors).

### E2E Tests (`e2e/api.spec.js` & `e2e/mock-server.js`)
* **Required Fields**: `ort` and `datum` are mandatory. Lack of either triggers a `400 Bad Request` (E2E Tests 21 & 22).
* **Date Parsing & Formatting**: Date must match `YYYY-MM-DD` and represent a real calendar date (E2E Test 23). Dates like `2026/06/20` or `2026-06-32` must be rejected with status `400`.
* **Negative Values**: Numeric columns (`tauchgang_nr`, `dauer_min`, `tiefe_m`, `gewicht_kg`, `temperatur_c`) cannot be negative (E2E Tests 24–28).
* **Type Validation**: Fields like `tauchgang_nr` must be numbers, not strings (E2E Test 29).
* **`stempel` Field**: If provided, it must be an array of strings. If omitted or null, it should default to `[]`.

---

## 2. Logic Chain

1. **Premise 1**: The database layer is permissive. SQLite accepts negative numbers, text in numerical columns, and invalid JSON strings (unless strictly formatted JSON) because table definitions do not contain check constraints for ranges or types other than `stempel` (which checks `json_valid(stempel) AND json_type(stempel) = 'array'`).
2. **Premise 2**: Allowing malformed or logical anomalies (like negative depth/temperature or string values for numeric IDs) into the database will break the application downstream (e.g. frontend displaying visual errors, database queries throwing unhandled runtime exceptions when serialization fails).
3. **Premise 3**: Therefore, the Express routing layer must act as the primary gatekeeper, intercepting requests and validating payloads before calling `db.insertDive()`.
4. **Premise 4**: Creating a dedicated `backend/src/routes.js` module keeps `app.js` clean and separates route management from server setup. Registering this router under `/api` in `app.js` maintains compliance with the client expectation `GET /api/dives` and `POST /api/dives`.

---

## 3. Caveats

* **Database Connection Startup**: The routes assume the database connection has already been initialized via `initDb` (which is run during `server.js` startup). If a route is invoked before `db` is set up, it will throw an error. A global error handler is recommended in `app.js` to catch these database exceptions and return a `500 Internal Server Error`.
* **Frontend Scope**: No analysis has been performed on the Angular components. We assume the client side strictly conforms to the JSON models outlined in `PROJECT.md`.
* **Milestone 4 Integration**: The image upload endpoint (`POST /api/upload`) is excluded from this milestone but will eventually need to be added to the router once the Gemini service is implemented.

---

## 4. Conclusion

We recommend structuring the backend API as follows:

1. **Create `backend/src/routes.js`**: Define the Express router and implement `validateDive` middleware to perform request validation using standard Javascript logic (to avoid unnecessary dependencies).
2. **Register the routes in `backend/src/app.js`**: Import the router and register it at `/api`, along with a global error handling middleware to gracefully return a `500` response for unhandled runtime errors.
3. **Implement Input Validation Middleware**:
   * Verify presence and types of `ort` (string) and `datum` (string matching `YYYY-MM-DD`).
   * Perform calendar verification (e.g. check `Date` parsing limits).
   * Guard numeric fields against string types or negative numbers.
   * Ensure `stempel` is verified as an array of strings.

Concrete proposed implementation references have been written to the following files in this agent folder:
* `proposed_routes.js` - Complete router configuration with route validations.
* `proposed_app.js` - Layout integration showing how to register routes and attach the global error handler.

---

## 5. Verification Method

To verify the implementation of these endpoints once they are coded:

1. **Verify Unit/Integration Tests**: Run the backend test suite:
   ```bash
   cd backend
   npm test
   ```
2. **Verify E2E Suitability**: Execute Playwright E2E tests:
   ```bash
   npm run test
   ```
   (This tests the entire REST contract using Playwright fixtures).
3. **Invalidation Conditions**: The design is considered invalid if:
   * GET `/api/dives` returns `null` or unparsed JSON string for the `stempel` field.
   * POST `/api/dives` allows negative integers/floats to insert into the database.
   * POST `/api/dives` accepts dates in invalid calendar formats (e.g. `2026-06-32`).
