# Milestone 2 Backend DB Setup Analysis & Recommendations

This report contains structural recommendations, code configurations, and a verification testing strategy for **Milestone 2 (Backend DB Setup)** of the Digital Dive Log project.

---

## 1. Overview & Project Structure

To maintain clean separation of concerns and allow testability without running live servers, the backend directory structure should be organized as follows:

```
digital-dive-log/
├── backend/
│   ├── src/
│   │   ├── app.js          # Express application initialization and middleware
│   │   ├── server.js       # Main server entry point (database init & port binding)
│   │   ├── db.js           # Database connection, migrations, and query execution
│   │   └── routes.js       # API routes and business logic (stubbed for M2)
│   ├── tests/
│   │   └── db.test.js      # Jest schema verification tests
│   ├── .env.example        # Reference environment configuration
│   └── package.json        # Backend configuration, dependencies, and scripts
```

This layout separates Express application creation (`app.js`) from server listening and database boot-up (`server.js`), facilitating isolated unit and integration testing.

---

## 2. Recommendation for `backend/package.json`

The `package.json` file for the backend needs to define packages for web serving, database interactions, and testing.

### Proposed `backend/package.json` Structure
```json
{
  "name": "digital-dive-log-backend",
  "version": "1.0.0",
  "description": "Backend services for the Digital Dive Log application",
  "main": "src/server.js",
  "type": "commonjs",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "test": "jest --runInBand --detectOpenHandles",
    "test:coverage": "jest --coverage --runInBand",
    "lint": "eslint src/**/*.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "sqlite": "^5.1.1",
    "sqlite3": "^5.1.7"
  },
  "devDependencies": {
    "eslint": "^8.57.0",
    "jest": "^29.7.0",
    "nodemon": "^3.1.4",
    "supertest": "^7.0.0"
  },
  "jest": {
    "testEnvironment": "node",
    "verbose": true
  }
}
```

### Rationale for Dependencies
1. **`express`**: Fast, unopinionated, minimalist web framework for Node.js.
2. **`cors`**: Essential middleware to handle Cross-Origin Resource Sharing, allowing the Angular frontend (typically on port `4200`) to communicate with the Express API (typically on port `3000`).
3. **`dotenv`**: Loads environment variables from a `.env` file into `process.env`.
4. **`sqlite3`**: The core C++ compiled SQLite client library.
5. **`sqlite`**: A lightweight wrapper around `sqlite3` that provides modern ES6 **promise-based** methods. This avoids callback hell and makes `async/await` syntax possible for database initialization and queries.
6. **`nodemon` (DevDependency)**: Automatically restarts the node application when file changes in the directory are detected, accelerating local development.
7. **`jest` (DevDependency)**: Standard, feature-rich JS testing framework. Highly customizable, supports synchronous and asynchronous testing natively.
8. **`supertest` (DevDependency)**: Allows testing HTTP routes in Express without binding to real ports, by interacting directly with the exported `app` instance.

---

## 3. SQLite Database Configuration & Migrations (`backend/src/db.js`)

SQLite is an in-process library that implements a self-contained, serverless, zero-configuration, transactional SQL database engine. The `db.js` file needs to handle connecting to this file-based database, initializing the database schema, and exporting the database client.

### Proposed Code for `backend/src/db.js`
```javascript
const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

let dbInstance = null;

/**
 * Retrieves the current active database connection.
 * Throws an error if the database has not been initialized.
 * @returns {Database} The sqlite promise-based database instance
 */
function getDb() {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return dbInstance;
}

/**
 * Initializes the SQLite database connection and runs schema creation.
 * Supporting in-memory database configuration for isolated test runs.
 * @param {string} [dbPathOverride] Optional database path, e.g. ':memory:' for testing.
 * @returns {Promise<Database>} The initialized database instance.
 */
async function initDb(dbPathOverride) {
  // If an instance already exists, reuse it (singleton pattern)
  if (dbInstance) {
    return dbInstance;
  }

  // Determine database location: priority is Override (testing) -> Env var -> default local file
  const dbPath = dbPathOverride || process.env.DATABASE_URL || path.join(__dirname, '../dives.db');

  dbInstance = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Enable foreign keys constraints in SQLite
  await dbInstance.run('PRAGMA foreign_keys = ON;');

  // Run database migration/schema setup
  await runMigrations(dbInstance);

  console.log(`Database successfully connected and initialized at: ${dbPath}`);
  return dbInstance;
}

/**
 * Creates required tables and indexes if they do not exist.
 * @param {Database} db The database instance.
 */
async function runMigrations(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS dives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tauchgang_nr INTEGER NOT NULL,
      ort TEXT NOT NULL,
      datum TEXT NOT NULL,          -- ISO-8601 string format: YYYY-MM-DD
      sicht TEXT,                   -- Visibility, e.g., "20m"
      gewicht_kg REAL,              -- Weight in kilograms, float
      dauer_min INTEGER,            -- Dive duration in minutes
      tiefe_m REAL,                 -- Maximum depth in meters, float
      temperatur_c INTEGER,         -- Temperature in Celsius
      stroemung TEXT,               -- Current info, e.g., "mild"
      unterschrift_partner TEXT,    -- Partner signature string
      stempel TEXT,                 -- Stored as JSON array string
      created_at TEXT DEFAULT (datetime('now', 'utc'))
    );
  `);
}

/**
 * Closes the active database connection.
 */
async function closeDb() {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
}

module.exports = {
  initDb,
  getDb,
  closeDb
};
```

### Design Details
- **Singleton Pattern**: The `dbInstance` is kept as a local module variable. Once `initDb` is called, any subsequent calls retrieve the active connection, preventing multiple connections to the same SQLite file.
- **Asynchronous Execution**: Using `sqlite`'s `open` function wraps SQLite operations in Promises.
- **Isolation support**: `dbPathOverride` allows tests to pass `:memory:`, spawning a fresh database in RAM that disappears when closed.

---

## 4. Storing the `stempel` (Stamps) Field in SQLite

The `stempel` field is defined as an array of strings in the interface contract, for example: `["Scuba Club Dahab", "2026-06-20"]`. 

SQLite does not natively support array data types. We evaluated three architectural approaches:

### Option Evaluation Table

| Alternative | Implementation Method | Pros | Cons | Recommendation |
|---|---|---|---|---|
| **Option A: JSON Text Serialization** | Serialize to string (`JSON.stringify`) on save, deserialize (`JSON.parse`) on retrieval. Column type is `TEXT`. | - Preserves the single-table layout requirement.<br>- Highly performant for web integrations.<br>- Matches JavaScript native handling perfectly. | - Inefficient index querying of individual stamps (though possible via SQLite JSON functions). | **Recommended** |
| **Option B: Normalized Sub-table** | Create a `dive_stamps` table: `dive_id`, `stamp_text`. | - Clean relational mapping.<br>- Allows direct index lookup of individual stamps. | - Increases query complexity (requires joins/grouping).<br>- Requires double writes (inserting dive + iterating and inserting stamps).<br>- Violates single table specification. | Not recommended |
| **Option C: Separated Value Text**| Join array using a separator character (e.g. ``,`` or ``\|``) | - Extremely lightweight. | - Unreliable if the separator character appears in the stamp text.<br>- Fails string sanitization checks easily. | Not recommended |

### Proposed JSON serialization implementation in JavaScript
To ensure the rest of the application interacts with a normal JavaScript array rather than serialized string representations, mapping utilities should be written in `db.js` or in service layers.

#### Serializing on Write:
```javascript
async function insertDive(diveData) {
  const db = getDb();
  
  // Serialize the array to a JSON string
  const stempelSerialized = Array.isArray(diveData.stempel) 
    ? JSON.stringify(diveData.stempel) 
    : '[]';

  const result = await db.run(
    `INSERT INTO dives (
      tauchgang_nr, ort, datum, sicht, gewicht_kg, dauer_min, tiefe_m, temperatur_c, stroemung, unterschrift_partner, stempel
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      diveData.tauchgang_nr,
      diveData.ort,
      diveData.datum,
      diveData.sicht,
      diveData.gewicht_kg,
      diveData.dauer_min,
      diveData.tiefe_m,
      diveData.temperatur_c,
      diveData.stroemung,
      diveData.unterschrift_partner,
      stempelSerialized
    ]
  );
  
  return result.lastID;
}
```

#### Deserializing on Read:
```javascript
async function getDiveById(id) {
  const db = getDb();
  const row = await db.get('SELECT * FROM dives WHERE id = ?', [id]);
  
  if (row && row.stempel) {
    try {
      row.stempel = JSON.parse(row.stempel);
    } catch (e) {
      row.stempel = []; // Fallback in case of corruption
    }
  }
  return row;
}
```

---

## 5. Express Foundation Setup

The Express server setup is split into `app.js` (Express configuration) and `server.js` (HTTP execution and DB binding).

### Proposed `backend/src/app.js`
```javascript
const express = require('express');
const cors = require('cors');

const app = express();

// Standard middleware
app.use(cors());
app.use(express.json()); // Essential for handling JSON request bodies in POST requests

// Basic health check endpoint (satisfies Milestone 2)
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

// Route registration stub for M3+
// app.use('/api', require('./routes'));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: err.message || 'Internal Server Error'
  });
});

module.exports = app;
```

### Proposed `backend/src/server.js`
```javascript
const path = require('path');
// Load environment variables from backend root directory .env file
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const app = require('./app');
const { initDb, closeDb } = require('./db');

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Initialize SQLite Database before turning on HTTP server listener
    await initDb();
    
    const server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });

    // Handle graceful shutdowns to release SQLite lock cleanly
    const shutdown = async (signal) => {
      console.log(`Received ${signal}. Shutting down server gracefully...`);
      server.close(async () => {
        await closeDb();
        console.log('HTTP Server and SQLite connection closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
```

---

## 6. Verification Testing Strategy

For database verification, testing should focus on three aspects:
1. Verification that the SQLite database file and tables are initialized correctly.
2. Verification that the database schema (columns, types, constraints) matches specification.
3. Verification that JavaScript arrays are correctly stored and retrieved (serialization/deserialization logic).

### Database Test Script (`backend/tests/db.test.js`)
Here is a complete Jest script for verifying Milestone 2 requirements:

```javascript
const { initDb, closeDb, getDb } = require('../src/db');

describe('Database Initialization & Schema Verification', () => {
  let db;

  // Use :memory: database to isolate test executions
  beforeAll(async () => {
    db = await initDb(':memory:');
  });

  afterAll(async () => {
    await closeDb();
  });

  test('should initialize an in-memory database connection successfully', () => {
    expect(db).toBeDefined();
    expect(getDb()).toBe(db);
  });

  test('should create the "dives" table with correct schema', async () => {
    // Query table information in SQLite using PRAGMA
    const columns = await db.all('PRAGMA table_info(dives)');
    
    // Convert to easy-to-test key-value map
    const schemaMap = {};
    columns.forEach(col => {
      schemaMap[col.name] = {
        type: col.type,
        notnull: col.notnull,
        pk: col.pk
      };
    });

    // Check critical schema pillars
    expect(schemaMap.id).toEqual({ type: 'INTEGER', notnull: 0, pk: 1 });
    expect(schemaMap.tauchgang_nr).toEqual({ type: 'INTEGER', notnull: 1, pk: 0 });
    expect(schemaMap.ort).toEqual({ type: 'TEXT', notnull: 1, pk: 0 });
    expect(schemaMap.datum).toEqual({ type: 'TEXT', notnull: 1, pk: 0 });
    expect(schemaMap.stempel).toEqual({ type: 'TEXT', notnull: 0, pk: 0 });
    expect(schemaMap.created_at).toBeDefined();
  });

  test('should handle JSON-serialized "stempel" array field correctly during write and read', async () => {
    // Create record with stempel array
    const testDive = {
      tauchgang_nr: 1,
      ort: 'El Fanadir',
      datum: '2026-06-21',
      sicht: '15m',
      stempel: ['Red Sea Divers Hurghada', '2026-06-21']
    };

    // Serialized storage
    const serializedStempel = JSON.stringify(testDive.stempel);

    // Insert directly
    const result = await db.run(
      `INSERT INTO dives (tauchgang_nr, ort, datum, sicht, stempel) VALUES (?, ?, ?, ?, ?)`,
      [testDive.tauchgang_nr, testDive.ort, testDive.datum, testDive.sicht, serializedStempel]
    );

    expect(result.lastID).toBeDefined();

    // Query and check parsing
    const row = await db.get('SELECT * FROM dives WHERE id = ?', [result.lastID]);
    
    expect(row).toBeDefined();
    expect(row.ort).toBe('El Fanadir');
    
    // Confirm raw SQLite data is a string
    expect(typeof row.stempel).toBe('string');
    
    // Parse to array and assert structure
    const parsedStempel = JSON.parse(row.stempel);
    expect(Array.isArray(parsedStempel)).toBe(true);
    expect(parsedStempel).toEqual(testDive.stempel);
    expect(parsedStempel[0]).toBe('Red Sea Divers Hurghada');
  });

  test('should enforce database defaults (created_at date)', async () => {
    const result = await db.run(
      `INSERT INTO dives (tauchgang_nr, ort, datum) VALUES (?, ?, ?)`,
      [123, 'House Reef', '2026-06-21']
    );

    const row = await db.get('SELECT * FROM dives WHERE id = ?', [result.lastID]);
    expect(row.created_at).toBeDefined();
    
    // Verify it is a valid date string
    expect(new Date(row.created_at).getTime()).not.toBeNaN();
  });
});
```

---

## 7. Configuration Variables Reference (`.env.example`)

For running this in development, a reference `.env.example` should be provided:

```ini
# Application configuration
PORT=3000
NODE_ENV=development

# Database configuration
# Leave blank to use default backend/dives.db, or supply absolute path
DATABASE_URL=
```
