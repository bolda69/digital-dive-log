# Handoff Report: Milestone 3 REST API Endpoint Design

This report outlines the analysis of the `digital-dive-log` project backend and details the design and recommendations for implementing the `GET /api/dives` and `POST /api/dives` endpoints for Milestone 3.

---

## 1. Observation

Direct observations from the project codebase structure and test suites:

1. **Database Schema & Lack of Type Constraints in SQLite**:
   - In `backend/src/db.js`, the `dives` table schema includes a single explicit column check constraint on `stempel` (requiring a valid JSON array or null):
     ```sql
     stempel TEXT CHECK (stempel IS NULL OR (json_valid(stempel) AND json_type(stempel) = 'array'))
     ```
   - From `backend/src/db.adversarial.test.js` (lines 83–109) and `backend/src/verify-adversarial.js` (lines 120–136), we observed that the SQLite layer accepts physically impossible values, negative numeric values, and incorrect datatypes (such as string text for integers) due to default dynamic typing.
     - Verbatim comment in `verify-adversarial.js`: `"Note: Database layer allows negative values natively (expected behavior, range constraints handled by API/Controller)."`
     - Verification test:
       ```javascript
       const extremeDive = {
         tauchgang_nr: -999,
         ort: "Dahab",
         datum: "2026-06-20",
         gewicht_kg: -50.5,
         dauer_min: -120,
         tiefe_m: -10000.5,
         temperatur_c: -500,
       };
       const insertedExtreme = await insertDive(extremeDive); // Succeeds at DB level
       ```

2. **Validation Expectations in E2E Test Suite**:
   - The test suite `e2e/api.spec.js` demands strict validation checks for `POST /api/dives`:
     - **Required Fields**: `ort` and `datum` are required. Missing either returns `400` (Tests 21 & 22).
     - **Date format**: `datum` must be a valid date in `YYYY-MM-DD` format (Test 23). E.g., `"2026/06/20"`, `"invalid"`, and invalid calendar days like `"2026-06-32"` must return `400`.
     - **Non-negativity**: Negative values for `tauchgang_nr` (Test 24), `dauer_min` (Test 25), `tiefe_m` (Test 26), `gewicht_kg` (Test 27), and `temperatur_c` (Test 28) must return `400`.
     - **Type-safety**: Invalid types like string for `tauchgang_nr` (e.g. `"527"`) must return `400` (Test 29).

3. **E2E State Isolation**:
   - `e2e/api.spec.js` runs a `beforeEach` hook calling `POST /api/mock/reset` to restore the list to an initial baseline dive (lines 5–8):
     ```javascript
     test.beforeEach(async ({ request }) => {
       const resetRes = await request.post('/api/mock/reset');
       expect(resetRes.status()).toBe(200);
     });
     ```
   - The baseline dive (id: 1) has specific fields (ort: `"Dahab Blue Hole"`, datum: `"2026-06-20"`, etc.) and is expected to be present by `GET /api/dives` right after resetting (Test 11).

---

## 2. Logic Chain

1. **DB Constraints Laxity & API Layer Responsibility**:
   - Since SQLite accepts invalid formats, negative values, and wrong datatypes natively (Observation 1), the Express application router is fully responsible for verifying and sanitizing incoming request bodies before database write operations.
   
2. **Deriving Validations from Tests**:
   - To pass the E2E tests (Observation 2), the `POST /api/dives` validation must verify:
     - `ort` and `datum` are present, non-empty, and strings.
     - `datum` is structured as `YYYY-MM-DD` and forms a logically valid calendar date.
     - If optional numeric fields (`tauchgang_nr`, `dauer_min`, `tiefe_m`, `gewicht_kg`, `temperatur_c`) are passed:
       - They must be of type `'number'`.
       - They must be `>= 0` (non-negative).
     - If optional `stempel` is passed, it must be an array of strings.

3. **Routing Separation**:
   - According to the layout defined in `PROJECT.md` (`backend/src/routes.js` to handle API route definitions), we should keep controller logic separate from the central `app.js` file. `app.js` should only mount the router at `/api`.

4. **Integration with `db.js`**:
   - For `GET /api/dives`, calling `getAllDives()` will fetch records ordered by `id DESC` with `stempel` JSON automatically parsed back to JS arrays by the database wrapper.
   - For `POST /api/dives`, calling `insertDive(payload)` will insert the validated object, handle stringification of `stempel` arrays, and return the newly saved row including database-allocated `id` and `created_at` timestamp.

5. **Test Isolation Support**:
   - To make the real server compatible with E2E tests, the router should conditionally register `POST /api/mock/reset` when running in `test` environment (`process.env.NODE_ENV === 'test'`). This reset route must clear the database tables and seed the initial baseline dive (Observation 3).

---

## 3. Caveats

- **Test Database Configuration**: During unit/integration testing of the routes, Jest will need to initialize the database in-memory (`initDb(':memory:')`) or to a test database file to prevent route handlers from throwing "Database not initialized" errors.
- **Strict Temperature Range**: While negative temperatures (in Celsius) are physical realities in ice diving, Test 28 specifically asserts that `temperatur_c` below `0` must return `400 Bad Request`. The validation logic must conform to this constraint.

---

## 4. Conclusion

We recommend the following backend design and structure for Milestone 3:

1. **Route File Structure**:
   - Create `backend/src/routes.js` to define endpoints `GET /dives` and `POST /dives` (mounted on `/api` in `app.js`).
   - Import `insertDive`, `getAllDives`, `getDb`, and `initDb` from `./db`.

2. **Validation Framework**:
   - Write standard inline or middleware validations in `routes.js` according to the constraints listed in the *Logic Chain* section.

3. **Mock Reset Capability**:
   - Implement `POST /api/mock/reset` inside `routes.js`, gated by `if (process.env.NODE_ENV === 'test')`, which drops all dive records and seeds the baseline dive (id: 1).

We have drafted and saved reference implementations matching these design recommendations in this agent's directory:
- Reference Router: `.agents/teamwork_preview_explorer_m3_1/proposed_routes.js`
- Reference Express Application Setup: `.agents/teamwork_preview_explorer_m3_1/proposed_app.js`

---

## 5. Verification Method

To verify the designed implementation when it is written to the main files:

1. **Examine Proposed Files**:
   - Inspect `/home/daniel/IdeaProjects/digital-dive-log/.agents/teamwork_preview_explorer_m3_1/proposed_routes.js` to check the completeness of validation checks.

2. **Execute Unit Tests**:
   - Navigate to `backend` folder and run the unit tests:
     ```bash
     npm test
     ```
   - Ensure `db.test.js`, `app.test.js`, and any new route test files pass.

3. **Execute E2E Tests**:
   - Start the server under a test environment (so `/api/mock/reset` is exposed) and run the E2E tests:
     ```bash
     PORT=3000 NODE_ENV=test npm start &
     npx playwright test
     ```
   - All 38 E2E test cases in `e2e/api.spec.js` must pass.
