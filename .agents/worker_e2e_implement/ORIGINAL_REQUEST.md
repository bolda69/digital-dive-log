## 2026-06-21T20:43:49Z
You are the E2E Testing Track Worker (teamwork_preview_worker).
Your working directory is: /home/daniel/IdeaProjects/digital-dive-log/.agents/worker_e2e_implement.

Your goal is to build the test infrastructure and implement a comprehensive opaque-box test suite (Tiers 1-4) in the project repository, then run the tests to verify they pass against the mock server, and write TEST_INFRA.md and TEST_READY.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Please implement the following files in the project workspace:

1. Root package.json:
Define scripts for starting mock server ("start:mock": "node e2e/mock-server.js") and running tests ("e2e": "playwright test", "e2e:ui": "playwright test --ui").
Include dependencies: Express, Cors, Multer, and devDependencies: @playwright/test.

2. playwright.config.js (at project root):
Configure Playwright to run tests in the "e2e" directory. Set workers to 1 to avoid state collisions in mock server, fullyParallel to false, timeout to 30000.
Set up the `webServer` config to start the mock server:
```javascript
webServer: {
  command: 'node e2e/mock-server.js',
  port: 3000,
  reuseExistingServer: !process.env.CI,
}
```

3. TEST_INFRA.md (at project root):
Use the template from the Project Pattern. Include the test philosophy, feature inventory (Upload & Extract, Save Dive, Retrieve Dives), test architecture (Playwright test runner details, mock server port 3000, e2e/ folder layout), and real-world scenarios.

4. e2e/mock-server.js:
Write a robust Node.js Express server running on port 3000. It must support:
- CORS and JSON parsing.
- POST /api/mock/reset -> Resets the mock in-memory dives list to initial baseline containing one dive (id: 1, tauchgang_nr: 527, etc.).
- GET /api/dives -> Returns the current list of dives (JSON array).
- POST /api/upload -> Handles image file upload via multer ('image' field).
  - Return 400 if no file is uploaded.
  - Return 400 if filename contains "invalid_ocr" or similar.
  - Return 400 if file mimetype is not an image (e.g. text/plain for .txt files).
  - Return 413 (Payload Too Large) if filename contains "large_file".
  - Return 400 if filename contains "empty_file".
  - Otherwise, return standard mock JSON extraction payload:
    `{"tauchgang_nr": 527, "ort": "Dahab Blue Hole", "datum": "2026-06-20", "sicht": "20m", "gewicht_kg": 8.0, "dauer_min": 45, "tiefe_m": 28.5, "temperatur_c": 24, "stroemung": "mild", "unterschrift_partner": "John Doe", "stempel": ["Scuba Club Dahab", "2026-06-20"]}`
- POST /api/dives -> Saves a dive.
  - Returns 400 if missing `ort` or `datum` fields.
  - Returns 400 if `tauchgang_nr` is present but is not a number or null (e.g. string).
  - Returns 400 if `datum` is not a valid YYYY-MM-DD string.
  - Returns 400 if any of: `tauchgang_nr`, `dauer_min`, `tiefe_m`, `gewicht_kg`, `temperatur_c` is negative.
  - Generates a new auto-incremented integer ID and `created_at` timestamp.
  - Appends to in-memory dives and returns 201 Created with the saved record.

5. Fixtures:
Create dummy files under e2e/fixtures/ for testing (e.g., standard_log.png, invalid_ocr.png, text_file.txt, large_file.png, empty_file.png, unsupported_file.pdf). They can contain simple dummy contents (or empty/small bytes) as they will be evaluated by name and type.

6. e2e/api.spec.js:
Implement a comprehensive Playwright test suite. Use Playwright's built-in APIRequestContext (using `request` object) to test the HTTP API endpoints directly.
Implement exactly the following 38 test cases grouped by Tier:

### Tier 1: Feature Coverage
Verify the core functionalities (N=3 features: Upload, Save, List). Implement at least 15 tests:
1. Upload valid PNG image -> returns 200 OK and valid JSON matching the schema.
2. Upload valid JPEG image -> returns 200 OK and valid JSON.
3. Upload valid GIF image -> returns 200 OK and valid JSON.
4. Verify response schema types (tauchgang_nr is number, ort is string, datum is date string, stempel is array).
5. Verify response contains nulls for optional fields if simulation suggests it.
6. Save dive with all fields populated -> returns 201 Created and response contains database-assigned fields (id, created_at).
7. Save dive with minimal fields (only ort and datum) -> returns 201 Created.
8. Save dive with very large tauchgang_nr (99999) -> succeeds.
9. Save dive with long text for ort (200 characters) -> succeeds.
10. Save dive with multiple stamps in stempel array -> succeeds.
11. Retrieve list when empty (call reset then check GET /api/dives, wait, mock reset puts 1 initial dive, so mock server reset could clear all or put 1, let's say the list returns the baseline dives).
12. Retrieve list after saving 1 dive -> list length is baseline + 1.
13. Retrieve list after saving multiple dives -> list length is updated and contains correct records.
14. Verify each returned dive in list contains database fields id and created_at.
15. Verify response header Content-Type is application/json.

### Tier 2: Boundary & Corner Cases
Implement at least 15 tests:
16. Upload with no file attached -> returns 400 Bad Request.
17. Upload non-image text file -> returns 400 Bad Request.
18. Upload excessively large file (using large_file fixture) -> returns 413 Payload Too Large.
19. Upload empty file -> returns 400 Bad Request.
20. Upload unsupported extension (e.g., .pdf) -> returns 400 Bad Request.
21. Save dive with missing required field 'ort' -> returns 400.
22. Save dive with missing required field 'datum' -> returns 400.
23. Save dive with invalid date format (e.g. "2026/06/20" or "invalid") -> returns 400.
24. Save dive with negative tauchgang_nr -> returns 400.
25. Save dive with negative dauer_min -> returns 400.
26. Save dive with negative tiefe_m -> returns 400.
27. Save dive with negative gewicht_kg -> returns 400.
28. Save dive with negative temperatur_c -> returns 400.
29. Save dive with invalid type for tauchgang_nr (string) -> returns 400.
30. Save dive with malformed JSON body -> returns 400.

### Tier 3: Cross-Feature Combinations
Implement at least 3 tests:
31. Upload -> Save: upload an image, modify some fields in the returned JSON, then send that payload to POST /api/dives. Verify it saves successfully.
32. Save -> List: POST a new dive, then GET the list, and verify the response includes the new dive with correct details.
33. Upload -> Save -> List: Full chain.

### Tier 4: Real-World Application Scenarios
Implement at least 5 tests simulating complete flows:
34. Scenario 1: Standard Dive Logging Journey.
35. Scenario 2: Manual Correction Journey.
36. Scenario 3: Multi-Dive Batch Logging.
37. Scenario 4: Recovery from Invalid Input.
38. Scenario 5: Full System Integration and Stamp Extraction.

7. Run the tests:
- Initialize the package.json and install dependencies.
- Run `npm install` and `npx playwright install` if needed, then run the tests via `npx playwright test`.
- Verify that all 38 tests pass.
- Write TEST_READY.md at the project root with the test execution output and coverage summary.

Document your work and findings in `/home/daniel/IdeaProjects/digital-dive-log/.agents/worker_e2e_implement/handoff.md` and send a message to your parent (Conv ID: 0e749e1d-add7-40d2-935f-8d7089d825ce).
