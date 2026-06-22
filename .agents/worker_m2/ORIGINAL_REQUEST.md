## 2026-06-21T22:44:13Z
Build the backend foundation and SQLite DB setup (Milestone 2) for the digital-dive-log application.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Instructions:
1. Initialize the backend package structure inside `/home/daniel/IdeaProjects/digital-dive-log/backend/` by creating `package.json`. Include dependencies for: `express`, `cors`, `dotenv`, `sqlite3`, `sqlite`. Include devDependencies for: `jest`, `supertest`. Include scripts for `start`, `dev`, and `test`.
2. Implement `backend/src/db.js` with:
   - DB connection wrapper using SQLite's `sqlite3` and `sqlite` modules.
   - An `initDb(dbPathOverride)` function that creates the `dives` table if it doesn't exist, using appropriate SQL schemas and data types matching the PROJECT.md schema.
   - Ensure the `stempel` column stores a serialized JSON string representing the stamps array. Validate it with a CHECK constraint checking `json_valid(stempel)`.
   - Provide helper functions to insert and retrieve records, automatically parsing `stempel` back into a JS array on retrieval, and stringifying it on insertion.
   - Ensure you expose a `closeDb()` method to close the connection cleanly.
3. Decouple the Express app config in `backend/src/app.js` and server listener in `backend/src/server.js`.
   - `app.js` must set up CORS, JSON body parser, and a simple health check endpoint `GET /api/health` returning `{"status": "ok"}`.
   - `server.js` must import `app.js`, call `initDb(process.env.DB_PATH || './dives.db')`, and listen on `process.env.PORT || 3000`.
4. Create a Jest unit test `backend/src/db.test.js` to verify:
   - Database initialization works.
   - Inserting a dive with valid properties (including a `stempel` array) saves correctly and retrieves correctly.
   - Inserting invalid JSON into the `stempel` column fails due to schema validation constraints (e.g. inserting via raw query with bad JSON).
5. Run the tests by executing `npm install` and `npm test` from the `backend/` directory, documenting the commands and outputs.
6. Only write metadata/handoffs to your working directory: `/home/daniel/IdeaProjects/digital-dive-log/.agents/worker_m2/`. All source code files must go in `backend/`.
7. Write `progress.md` and finally `handoff.md` in your working directory.
