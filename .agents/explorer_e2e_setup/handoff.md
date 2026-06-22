# Handoff: E2E Test Setup Proposal

## 1. Observation
- **Codebase State**: Running `list_dir` on the project root `/home/daniel/IdeaProjects/digital-dive-log` returned only two items:
  ```json
  {"name":".agents", "isDir":true}
  {"name":"PROJECT.md", "sizeBytes":"6318"}
  ```
  This indicates that no application source code, tests, or build configuration files currently exist.
- **Project Structure**: As defined in `/home/daniel/IdeaProjects/digital-dive-log/PROJECT.md` (lines 39-69), the project is split into `backend/` and `frontend/` directories, alongside a root-level `package.json`.
- **API Contracts**: As defined in `PROJECT.md` (lines 82-156), the backend must support three endpoints:
  - `POST /api/upload` (multipart/form-data, accepts `image`, returns parsed JSON dive details).
  - `GET /api/dives` (returns JSON list of saved dives).
  - `POST /api/dives` (accepts verified JSON dive details, returns the created dive with `id` and `created_at` timestamp).

## 2. Logic Chain
- **Test Runner Framework Selection**:
  - **Decision**: Playwright (`@playwright/test`) is chosen for E2E testing.
  - **Reasoning**: Unlike basic test runners (such as Jest or Mocha) which require third-party libraries (like Puppeteer) and complex setup to drive a browser, Playwright is a complete, modern E2E solution. It features robust auto-waiting, built-in assertion engines, and supports headless/headed execution across multiple browsers (Chromium, Firefox, WebKit). Furthermore, Playwright's `webServer` configuration allows it to spawn and teardown both the frontend server and the mock backend server automatically before and after test runs.
- **Directory Layout**:
  - **Decision**: Place E2E tests, configs, and mock utilities in an `e2e/` directory at the project root, with a `playwright.config.js` file at the root.
  - **Reasoning**: Keeping E2E assets in a top-level `e2e/` folder keeps them separated from specific codebase packages (`frontend/` and `backend/`), avoiding module pollution. This obeys the rule of keeping tests out of the `.agents/` folder.
- **Package Scripts**:
  - **Decision**: Define commands in the root `package.json` to invoke Playwright.
  - **Reasoning**: Developers can run `npm run e2e` at the root, which uses Playwright to orchestrate test runs cleanly.
- **Mock Server Design**:
  - **Decision**: Write a lightweight Node.js Express server (`e2e/mock-server.js`) that uses `multer` to handle files and keeps an in-memory array of dives.
  - **Reasoning**: Using Express matches the backend's target framework. Keeping state in memory allows `GET /api/dives` to dynamically update after a `POST /api/dives` occurs, validating the full end-to-end user flow (upload -> edit -> save -> list update) before any database or real AI services are implemented. A `POST /api/mock/reset` endpoint is added to reset the state to a known baseline for test isolation.

## 3. Caveats
- State is held purely in-memory in the mock server. Restarts will clear any added dives. Tests should use the `/api/mock/reset` endpoint to ensure isolation.
- The Angular app must be configured to proxy its API requests to the mock server port (3000) during development and E2E testing (e.g. using Angular's `proxy.conf.json`).
- The mock server does not perform actual OCR or Gemini API calls. It returns static mocked JSON schemas unless specifically programmed to vary output based on parameters (e.g. the uploaded file name).

## 4. Conclusion

We propose the following testing infrastructure design:

### A. Folder Layout
```
digital-dive-log/
├── e2e/
│   ├── mock-server.js      # Express API mock server
│   └── dive-log.spec.js    # Playwright E2E test file
├── playwright.config.js    # Playwright runner configuration
└── package.json            # Monorepo root dependencies and scripts
```

### B. Playwright Configuration (`playwright.config.js`)
```javascript
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  fullyParallel: false,
  workers: 1, // Keep single-worker to avoid state collisions in mock server
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:4200', // URL of the Angular frontend
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    }
  ],
  // Automatically start the mock server and Angular frontend before running tests
  webServer: [
    {
      command: 'node e2e/mock-server.js',
      port: 3000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run start --prefix frontend',
      port: 4200,
      reuseExistingServer: !process.env.CI,
    }
  ],
});
```

### C. Mock Server Implementation (`e2e/mock-server.js`)
```javascript
const express = require('express');
const cors = require('cors');
const multer = require('multer');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// Initial mockup data
const INITIAL_DIVES = [
  {
    id: 1,
    tauchgang_nr: 527,
    ort: "Dahab Blue Hole",
    datum: "2026-06-20",
    sicht: "20m",
    gewicht_kg: 8.0,
    dauer_min: 45,
    tiefe_m: 28.5,
    temperatur_c: 24,
    stroemung: "mild",
    unterschrift_partner: "John Doe",
    stempel: ["Scuba Club Dahab", "2026-06-20"],
    created_at: "2026-06-21T20:42:00Z"
  }
];

let dives = JSON.parse(JSON.stringify(INITIAL_DIVES));

// Endpoint to reset mock database state between test runs
app.post('/api/mock/reset', (req, res) => {
  dives = JSON.parse(JSON.stringify(INITIAL_DIVES));
  res.status(200).json({ status: 'reset' });
});

// 1. Upload Dive Log Image
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file uploaded' });
  }

  // Simulate parsing error if the filename contains 'invalid'
  if (req.file.originalname.includes('invalid')) {
    return res.status(400).json({ error: 'Failed to extract data from image' });
  }

  // Return standard mock OCR output
  res.status(200).json({
    tauchgang_nr: 527,
    ort: "Dahab Blue Hole",
    datum: "2026-06-20",
    sicht: "20m",
    gewicht_kg: 8.0,
    dauer_min: 45,
    tiefe_m: 28.5,
    temperatur_c: 24,
    stroemung: "mild",
    unterschrift_partner: "John Doe",
    stempel: ["Scuba Club Dahab", "2026-06-20"]
  });
});

// 2. Get All Dives
app.get('/api/dives', (req, res) => {
  res.status(200).json(dives);
});

// 3. Save Verified Dive
app.post('/api/dives', (req, res) => {
  const body = req.body;
  if (!body.ort || !body.datum) {
    return res.status(400).json({ error: 'Missing required dive fields (ort, datum)' });
  }

  const newDive = {
    id: dives.length ? Math.max(...dives.map(d => d.id)) + 1 : 1,
    tauchgang_nr: body.tauchgang_nr || null,
    ort: body.ort,
    datum: body.datum,
    sicht: body.sicht || null,
    gewicht_kg: body.gewicht_kg || null,
    dauer_min: body.dauer_min || null,
    tiefe_m: body.tiefe_m || null,
    temperatur_c: body.temperatur_c || null,
    stroemung: body.stroemung || null,
    unterschrift_partner: body.unterschrift_partner || null,
    stempel: body.stempel || [],
    created_at: new Date().toISOString()
  };

  dives.push(newDive);
  res.status(201).json(newDive);
});

app.listen(port, () => {
  console.log(`E2E API Mock Server running at http://localhost:${port}`);
});
```

### D. Playwright E2E Test Suite (`e2e/dive-log.spec.js`)
```javascript
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Digital Dive Log E2E Flow', () => {
  
  test.beforeEach(async ({ request }) => {
    // Reset mock server state before each test
    const response = await request.post('http://localhost:3000/api/mock/reset');
    expect(response.ok()).toBeTruthy();
  });

  test('should upload, verify, save, and list a new dive log', async ({ page }) => {
    // Step 1: Navigate to the upload view
    await page.goto('/');

    // Check header or component existence to verify page loaded
    await expect(page.locator('h1')).toContainText('Digital Dive Log');

    // Step 2: Upload a sample log image
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('button#upload-trigger'); // Trigger file selector dialog
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.join(__dirname, 'fixtures/sample_dive_log.jpg'));

    // Step 3: Wait for verification view to load with mock API response details
    // Verification view input fields should be pre-filled with the mock data
    const locationInput = page.locator('input#ort');
    await expect(locationInput).toHaveValue('Dahab Blue Hole');

    const diveNumInput = page.locator('input#tauchgang_nr');
    await expect(diveNumInput).toHaveValue('527');

    const weightInput = page.locator('input#gewicht_kg');
    await expect(weightInput).toHaveValue('8.0');

    // Step 4: Correct/Edit data in the verification form
    await locationInput.fill('Dahab Canyon');
    await weightInput.fill('10.0');

    // Step 5: Save/Submit the verified dive log entry
    await page.click('button#save-dive');

    // Step 6: Verify redirection to List view and presence of the new dive
    await expect(page).toHaveURL(/.*list/);
    
    // Check that history list contains the newly created record with updated details
    const diveItems = page.locator('.dive-item');
    await expect(diveItems).toContainText('Dahab Canyon');
    await expect(diveItems).toContainText('10 kg');
    await expect(diveItems).toContainText('Tauchgang Nr: 527');
  });

  test('should display error message on upload failure', async ({ page }) => {
    await page.goto('/');

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('button#upload-trigger');
    const fileChooser = await fileChooserPromise;
    
    // Uploading a file name containing 'invalid' triggers mock API error
    await fileChooser.setFiles(path.join(__dirname, 'fixtures/invalid_dive_log.jpg'));

    // Verify error notification is displayed
    const errorMessage = page.locator('.error-banner');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('Failed to extract data from image');
  });
});
```

### E. Root `package.json` Scripts Block
In the main `package.json` of the project, we should define:
```json
{
  "name": "digital-dive-log",
  "version": "1.0.0",
  "scripts": {
    "start:mock": "node e2e/mock-server.js",
    "e2e": "playwright test",
    "e2e:ui": "playwright test --ui"
  },
  "devDependencies": {
    "@playwright/test": "^1.40.0",
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "multer": "^1.4.5-lts.1"
  }
}
```

## 5. Verification Method
1. **Directory Structure Verification**: Ensure files are placed exactly at:
   - Root level: `playwright.config.js`, `package.json`
   - Test folder: `e2e/mock-server.js`, `e2e/dive-log.spec.js`
2. **Mock Server Operation**:
   - Install dependencies: `npm install express cors multer`
   - Start the server: `node e2e/mock-server.js`
   - Test HTTP endpoints using curl or a client:
     - `curl http://localhost:3000/api/dives` should return the list of initial dives.
     - `curl -X POST -H "Content-Type: application/json" -d '{"ort":"Dahab", "datum":"2026-06-20"}' http://localhost:3000/api/dives` should return the saved entry.
     - Re-running `curl http://localhost:3000/api/dives` should now show both dives.
3. **Playwright Execution Verification**:
   - Run `npx playwright test` to run the suite. The system will start mock and frontend servers, perform the tests in headless Chromium, and output the report.
