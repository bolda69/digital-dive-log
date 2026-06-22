## 2026-06-22T01:04:48Z

Your identity is Worker (M4 Implement). Your working directory is /home/daniel/IdeaProjects/digital-dive-log/.agents/teamwork_preview_worker_m4_implement.
Your task is to implement Milestone 4 (AI Gemini Integration) in the digital-dive-log project.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Implementation requirements:
1. In `backend/package.json`: Add dependencies `multer` (version `^1.4.5-lts.1`) and `@google/genai` (version `^0.1.1`).
2. In `backend/src/gemini.js` (new file): Implement `extractDiveLog(imageBuffer, mimeType)` using `@google/genai` and `process.env.GEMINI_API_KEY`. It should parse the image using model `gemini-1.5-flash` with JSON schema config enforcement, returning parsed JSON conforming to the layout in PROJECT.md.
3. In `backend/src/routes.js`:
   - Mount a `POST /api/upload` endpoint using multer memoryStorage (10MB limit, fileFilter checking mimetype startsWith `image/`).
   - Validate and sanitize the AI model response: check required fields `ort` and `datum`, coerce/nullify optional numeric/text fields, and verify that `stempel` is a string array.
   - Implement simulation hooks for test environments: when `process.env.NODE_ENV === 'test'` or `!process.env.GEMINI_API_KEY`, if the uploaded file's original name contains `invalid_ocr`, `large_file`, `empty_file`, or `null_optional`, return the corresponding status code or mock JSON structure to maintain compatibility with mock-server/E2E test suite specs.
4. In `backend/src/upload.test.js` (new test file): Write unit tests for `POST /api/upload` using `jest.mock('./gemini')` to mock the Gemini model API calls and verify correct status codes, sanitization logic, and error handling.
5. In `backend/`: Run `npm install` and `npm test` to verify all backend tests pass.
6. Run root E2E Playwright tests if possible to ensure everything compiles and runs against the mock/test environment.

Write your implementation report to /home/daniel/IdeaProjects/digital-dive-log/.agents/teamwork_preview_worker_m4_implement/handoff.md.
Send a message back to parent conversation ID: 0b267b6c-71cb-413c-8c1d-8f92342579c6 when completed.
