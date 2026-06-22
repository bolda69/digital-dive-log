# Digital Dive Log Backend

This is the backend service for the Digital Dive Log application, built with Node.js, Express, and SQLite.

## Configuration

The backend is configured using environment variables. You can define these in a `.env` file in the `backend/` root directory (see `.env.example` as a template).

- **`PORT`**: The port number on which the Express server listens. (Default: `3000`)
- **`DB_PATH`**: Absolute or relative path to the SQLite database file. (Default: `backend/dives.db` or `:memory:` for test suites)

## Scripts

You can run the following scripts from the `backend/` directory:

- **`npm start`**: Runs the backend server at `src/server.js` using Node.
- **`npm run dev`**: Alias to run the backend server in development mode.
- **`npm test`**: Runs the Jest test suites under `src/` sequentially and detects open handles.

## Verification

To verify the backend configuration and functionality:

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run the tests**:
   ```bash
   npm test
   ```
   This will execute all backend tests (e.g. `db.test.js`, `app.test.js`, and the adversarial tests), verifying the database schema, validations, and server endpoints.

3. **Start the server**:
   ```bash
   npm start
   ```
   Verify that the console logs show the server listening on the configured port and the database initializing correctly.
