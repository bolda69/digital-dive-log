# Implementation Track Execution Plan

## Milestones and Verification Plan

### Milestone 2: Backend DB Setup (Express setup, SQLite config, migrations)
- **Objective**: Create backend package structure, configure SQLite database module `db.js`, define database schema for `dives` table (storing `stempel` as serialized JSON/array or similar, e.g. text/blob), write setup/migration logic, and verify initialization.
- **Steps**:
  1. Initialize `package.json` for backend if not present.
  2. Implement SQLite db connection & table initialization in `backend/src/db.js`.
  3. Create an entry point / app config `backend/src/app.js` and `backend/src/server.js`.
  4. Write unit tests for DB operations (e.g. creating database, table validation).
  5. Run build/tests and Forensic Audit.
- **Verification**:
  - Verification test script / test suite executes database initialization successfully.
  - File `dives.db` is created.
  - Forensic audit returns CLEAN.

### Milestone 3: Backend REST API (CRUD endpoints for dives)
- **Objective**: Implement `GET /api/dives` and `POST /api/dives` endpoints in `backend/src/routes.js`.
- **Steps**:
  1. Add endpoint routes in routes module.
  2. Wire routes to app/server.
  3. Implement insertion and retrieval db helper functions in `db.js`.
  4. Write integration tests using Supertest or similar to test request/response payloads.
  5. Run tests and Forensic Audit.
- **Verification**:
  - `GET /api/dives` returns list of dives.
  - `POST /api/dives` inserts new dive log record and returns it with generated fields (id, created_at).
  - Verification tests run successfully.
  - Forensic audit returns CLEAN.

### Milestone 4: AI Gemini Integration (Upload endpoint, Gemini API, validation)
- **Objective**: Implement `POST /api/upload` image processing route using `gemini.js` module.
- **Steps**:
  1. Add multer or similar multipart form parser for image upload.
  2. Implement Gemini Vision API integration in `backend/src/gemini.js` using `gemini-1.5-flash` or similar.
  3. Implement JSON schema extraction validation to ensure structured output.
  4. Write mock/stub tests for the Gemini API call to test parsing/extraction logic under offline/CI mode.
  5. Run tests and Forensic Audit.
- **Verification**:
  - `POST /api/upload` returns the extracted structured dive details.
  - Test suites execute successfully.
  - Forensic audit returns CLEAN.

### Milestone 5: Frontend App and Service Setup (Angular setup, routing, HTTP service)
- **Objective**: Initialize Angular application structure, configure routes, and implement `DiveService` to communicate with backend.
- **Steps**:
  1. Verify/initialize Angular project layout inside `frontend/`.
  2. Create `DiveService` in `frontend/src/app/services/dive.service.ts`.
  3. Implement HTTP calls for get, save, and upload.
  4. Set up routes in `app-routing.module.ts`.
  5. Write frontend unit tests for `DiveService` (mocking HttpClient).
  6. Run tests and Forensic Audit.
- **Verification**:
  - Angular build compiles successfully (`ng build` or test).
  - Test suites execute successfully.
  - Forensic audit returns CLEAN.

### Milestone 6: Frontend Components (Upload, Verification, and List views)
- **Objective**: Build Angular components for uploading images, verifying/editing extracted fields, and listing saved dive logs.
- **Steps**:
  1. Implement `UploadComponent` in `frontend/src/app/components/upload/`.
  2. Implement `VerificationComponent` in `frontend/src/app/components/verification/`.
  3. Implement `ListComponent` in `frontend/src/app/components/list/`.
  4. Wire components into `app.module.ts` and template.
  5. Write component tests.
  6. Run tests and Forensic Audit.
- **Verification**:
  - App builds and component tests pass.
  - Views render and process user interactions correctly.
  - Forensic audit returns CLEAN.

### Milestone 7: Integration and QA
- **Objective**: Execute end-to-end testing and perform adversarial coverage hardening.
- **Steps**:
  - **Phase 1**: Wait for E2E Test suite to publish `TEST_READY.md`. Run E2E tests, fix issues until all pass.
  - **Phase 2**: Run Adversarial Coverage Hardening (Tier 5) with Challengers and Workers.
  - **Forensic Audit**: Run Forensic Auditor for final verification.
- **Verification**:
  - All E2E test scenarios (Tiers 1-4) pass successfully.
  - Tier 5 coverage audit complete.
  - Forensic audit returns CLEAN.
