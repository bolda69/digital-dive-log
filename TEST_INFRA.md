# Test Infrastructure Documentation

## Test Philosophy
We utilize an **opaque-box testing methodology** to verify the digital dive log application. Under this model:
1. Tests interact only with the public interfaces (API endpoints) without requiring knowledge of internal database setups or third-party vision APIs.
2. The environment is **hermetic** and deterministic, achieved by running an in-memory mock server that mimics backend responses, and resetting the server's state between tests.
3. Testing is structured across **four distinct tiers** ranging from basic happy paths to complex real-world user flows.

## Feature Inventory
The test suite validates three core features:
1. **Upload & Extract**: Handles uploading logbook images and parsing key metrics (e.g. dive number, location, date, visibility, duration, etc.) through simulated OCR extraction.
2. **Save Dive**: Validates and persists verified dive records, ensuring constraints like valid dates and non-negative numbers are respected.
3. **Retrieve Dives**: Lists all recorded dives, verifying structural details like database IDs and creation timestamps.

## Test Architecture
- **Test Runner**: Playwright Test (`@playwright/test`) running in standard Node.js environment.
- **Mock Server**: Express-based Node.js application running on port 3000 (`e2e/mock-server.js`).
- **State Isolation**: High isolation achieved by:
  - Setting `workers: 1` in Playwright config to avoid concurrent API state collisions.
  - Exposing `/api/mock/reset` to reset state to the initial baseline before or after tests.

### Directory Layout
```
digital-dive-log/
├── e2e/
│   ├── fixtures/          # Image and document templates used for uploads
│   ├── mock-server.js     # Express server mocking database and vision API
│   └── api.spec.js        # Playwright API tests (Tiers 1-4)
├── playwright.config.js   # Playwright configuration
├── package.json           # Scripts and dependencies
└── TEST_INFRA.md          # This document
```

## Test Tiers

### Tier 1: Feature Coverage (Tests 1-15)
Ensures basic endpoints (`POST /api/upload`, `POST /api/dives`, `GET /api/dives`) work under happy-path conditions, returning appropriate MIME types, correct HTTP statuses, and adhering to payload types.

### Tier 2: Boundary & Corner Cases (Tests 16-30)
Ensures negative inputs, invalid date formats, missing fields, oversized payloads, and unsupported file uploads are cleanly rejected with standard `400 Bad Request` or `413 Payload Too Large` responses.

### Tier 3: Cross-Feature Combinations (Tests 31-33)
Tests interaction sequences such as saving an uploaded/extracted dive, listing saved dives, and checking the full pipeline continuity.

### Tier 4: Real-World Application Scenarios (Tests 34-38)
Executes complex multi-step workflows mapping directly to user behavior:
- **Scenario 1: Standard Dive Logging Journey** - Uploading, editing details, saving, and verifying the listing.
- **Scenario 2: Manual Correction Journey** - Correcting OCR mistakes before saving and listing.
- **Scenario 3: Multi-Dive Batch Logging** - Logging several dives in sequence and verifying list consistency.
- **Scenario 4: Recovery from Invalid Input** - Failing validation, correcting inputs, and completing the save flow.
- **Scenario 5: Full System Integration and Stamp Extraction** - Validating complete data models, including stamp arrays and signature verifications.
