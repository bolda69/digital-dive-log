# Backend Database & Express Foundation Analysis (Milestone 2)

## Executive Summary
This report analyzes the backend foundation for Milestone 2 (Backend DB Setup) of the Digital Dive Log project. The project is a greenfield Node.js/Express application. This analysis recommends:
1. A modular `package.json` structure optimized for development and testing.
2. An SQLite database module (`db.js`) designed for clean initialization, automated in-memory/file migration, and query management.
3. An Express architecture split between configurations (`app.js`) and listener setup (`server.js`) to facilitate seamless integration and API testing.
4. A comparison of strategies for storing the array-of-strings `stempel` (stamps) field in SQLite, recommending JSON string serialization.
5. A comprehensive Jest-based testing strategy to verify schema validation and table structure.

---

## 1. Backend `package.json` Recommendations

The `package.json` is configured to run the server in both production and development environments, and to run Jest tests sequentially.

### Proposed `package.json`
```json
{
  "name": "digital-dive-log-backend",
  "version": "1.0.0",
  "description": "Backend service for the Digital Dive Log application",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "test": "jest --runInBand --detectOpenHandles --coverage"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "sqlite": "^5.1.1",
    "sqlite3": "^5.1.7"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "nodemon": "^3.1.4",
    "supertest": "^7.0.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### Key Rationale
- **`sqlite` + `sqlite3`**: `sqlite3` is the native C++ driver for SQLite, and the `sqlite` package wraps it in modern, clean ES6 Promise interfaces. This avoids callback hell and aligns with standard `async/await` syntax.
- **`dotenv`**: Essential for loading environment configurations (e.g. `PORT`, `DATABASE_PATH`, `GEMINI_API_KEY`) without hardcoding values in source code.
- **`cors`**: Required since the Angular frontend will run on a different port (typically `4200`) and needs to communicate with the Express backend (typically `3000`).
- **`supertest`**: Used in devDependencies to mock HTTP requests for integration testing of routes in Milestone 3, without binding to active network ports.
- **`jest --runInBand --detectOpenHandles`**:
  - `--runInBand` forces tests to run sequentially in a single process. Parallel database tests can cause file-based SQLite databases to throw `SQLITE_BUSY` lock errors.
  - `--detectOpenHandles` tracks asynchronous resources (like open database connections or Express server handles) that are not properly cleaned up, ensuring tests exit cleanly.

---

## 2. SQLite Database Configuration & Migration (`backend/src/db.js`)

To ensure test isolation and flexibility, `db.js` must allow injecting a database path. This enables unit/integration tests to run in-memory (`:memory:`) or write to temporary test databases.

### Recommended `backend/src/db.js`
```javascript
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

let db = null;

/**
 * Initializes the SQLite database and executes migrations (table schemas).
 * Supports path override for unit/integration testing (e.g., ':memory:').
 * @param {string} [dbPathOverride] - Custom path to the SQLite file or ':memory:'
 * @returns {Promise<object>} The initialized SQLite database connection
 */
async function initDb(dbPathOverride) {
  const dbFile = dbPathOverride || process.env.DATABASE_PATH || path.join(__dirname, '../dives.db');

  db = await open({
    filename: dbFile,
    driver: sqlite3.Database
  });

  // Enable foreign keys for integrity
  await db.get('PRAGMA foreign_keys = ON');

  // Run schema migration / table creation
  await db.exec(`
    CREATE TABLE IF NOT EXISTS dives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tauchgang_nr INTEGER,
      ort TEXT,
      datum TEXT,
      sicht TEXT,
      gewicht_kg REAL,
      dauer_min INTEGER,
      tiefe_m REAL,
      temperatur_c INTEGER,
      stroemung TEXT,
      unterschrift_partner TEXT,
      stempel TEXT, -- JSON-serialized array of strings
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);

  return db;
}

/**
 * Returns the active database instance.
 * Throws an error if the database has not been initialized.
 * @returns {object} The SQLite database connection
 */
function getDb() {
  if (!db) {
    throw new Error('Database has not been initialized. Call initDb() first.');
  }
  return db;
}

/**
 * Closes the active database connection.
 * @returns {Promise<void>}
 */
async function closeDb() {
  if (db) {
    await db.close();
    db = null;
  }
}

module.exports = {
  initDb,
  getDb,
  closeDb
};
```

---

## 3. Express Foundation Configuration (`app.js` & `server.js`)

Splitting the Express application definition from the network listener startup is a fundamental backend design pattern. It decouples the API logic from the server lifecycle, enabling fast integration testing.

### Express Configuration (`backend/src/app.js`)
```javascript
const express = require('express');
const cors = require('cors');

const app = express();

// Global Middlewares
app.use(cors());
app.use(express.json()); // Parses application/json incoming payloads

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

// Import and register routing middleware (implemented in M3)
// const routes = require('./routes');
// app.use('/api', routes);

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

module.exports = app;
```

### Express Entry Point (`backend/src/server.js`)
```javascript
require('dotenv').config();
const app = require('./app');
const { initDb } = require('./db');

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // 1. Initialize SQLite connection and database schema
    await initDb();
    console.log('Database initialized and migrated successfully.');

    // 2. Start HTTP server
    app.listen(PORT, () => {
      console.log(`Express server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('Fatal initialization error:', error);
    process.exit(1);
  }
}

startServer();
```

---

## 4. Storing the `stempel` (Stamps) Field in SQLite

The `stempel` field is an array of strings parsed from the stamp images on a physical log (e.g., `["Scuba Club Dahab", "2026-06-20"]`). SQLite is a relational engine that does not support a native array type. We analyze two design options below.

### Comparison Table

| Feature / Detail | Option A: JSON-Serialized `TEXT` (Recommended) | Option B: Relational Join Table (`dive_stamps`) |
|---|---|---|
| **SQL Definition** | `stempel TEXT` column in `dives` table. | Separate table `dive_stamps` referencing `dives.id`. |
| **Insertion Strategy** | `JSON.stringify(stempel)` in JavaScript. Single SQL query insert. | Multi-query database transaction: 1. Insert dive, 2. Retrieve new `id`, 3. Insert each stamp element into `dive_stamps`. |
| **Retrieval Strategy** | `JSON.parse(row.stempel)` in JavaScript. Single SELECT statement. | SQL JOIN statement (`LEFT JOIN`) or separate query followed by array aggregation. |
| **DB Validation** | SQLite native JSON functions (e.g., `JSON_VALID(stempel)`) can enforce structure. | Standard relational constraints and foreign keys ensure data integrity. |
| **Performance** | Extremely high for CRUD (single disk I/O operation per record). | Slightly slower due to multiple inserts/joins. |
| **Complexity** | Minimal. Translates 1:1 with JSON REST API and Gemini output. | High. Adds schema noise, transaction logic, and mapping layers. |

### Recommendation
**Option A (JSON-Serialized `TEXT` column)** is highly recommended. 
- The application primarily performs bulk retrievals and uploads. There are no relational query requirements to search/index dives specifically by individual stamp text.
- Simple serialization matches the application schema exactly, minimizing SQL query complexity.
- SQLite natively includes JSON operators (e.g., `json_each`) starting from 3.38.0. If query capability on stamps is needed later, SQLite can query inside the text field without restructuring the database.

To ensure robustness, a database check constraint can be added to the column to prevent non-JSON text:
```sql
ALTER TABLE dives ADD COLUMN stempel TEXT CHECK(json_valid(stempel) OR stempel IS NULL);
```

---

## 5. Verification Testing Strategy (Jest/Mocha)

A robust testing strategy uses an in-memory SQLite database (`:memory:`) to verify the schema layout, columns, types, constraints, and JSON storage without leaving database files behind.

### Recommended Test File (`backend/src/db.test.js`)
```javascript
const { initDb, getDb, closeDb } = require('./db');

describe('Database Configuration & Schema Verification', () => {
  beforeAll(async () => {
    // Spin up a clean, isolated in-memory DB before running tests
    await initDb(':memory:');
  });

  afterAll(async () => {
    // Tear down connection to free resources
    await closeDb();
  });

  test('should successfully initialize and create the "dives" table', async () => {
    const db = getDb();
    const tableInfo = await db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='dives'"
    );
    expect(tableInfo).toBeDefined();
    expect(tableInfo.name).toBe('dives');
  });

  test('should match the schema column requirements', async () => {
    const db = getDb();
    const columns = await db.all("PRAGMA table_info(dives)");

    // Convert array metadata into an indexable map
    const schemaMap = {};
    columns.forEach(col => {
      schemaMap[col.name] = {
        type: col.type,
        notnull: col.notnull,
        pk: col.pk
      };
    });

    const expectedSchema = {
      id: { type: 'INTEGER', notnull: 0, pk: 1 },
      tauchgang_nr: { type: 'INTEGER', notnull: 0, pk: 0 },
      ort: { type: 'TEXT', notnull: 0, pk: 0 },
      stempel: { type: 'TEXT', notnull: 0, pk: 0 },
      created_at: { type: 'TEXT', notnull: 0, pk: 0 }
    };

    // Assert key columns exist and match types
    Object.keys(expectedSchema).forEach(columnName => {
      expect(schemaMap[columnName]).toBeDefined();
      expect(schemaMap[columnName].type).toBe(expectedSchema[columnName].type);
      expect(schemaMap[columnName].pk).toBe(expectedSchema[columnName].pk);
    });
  });

  test('should successfully write and read JSON-serialized arrays to the stempel column', async () => {
    const db = getDb();
    const mockStamps = ['Club Med Bali', 'Instructor Signature #12345'];

    // Insert mock record
    const insertResult = await db.run(
      `INSERT INTO dives (tauchgang_nr, ort, stempel) VALUES (?, ?, ?)`,
      [12, 'Tulamben Wreck', JSON.stringify(mockStamps)]
    );

    const insertedId = insertResult.lastID;
    expect(insertedId).toBeGreaterThan(0);

    // Retrieve inserted record
    const row = await db.get('SELECT * FROM dives WHERE id = ?', [insertedId]);
    expect(row).toBeDefined();
    expect(row.ort).toBe('Tulamben Wreck');
    expect(row.tauchgang_nr).toBe(12);

    // Parse and assert JSON array
    const parsedStamps = JSON.parse(row.stempel);
    expect(Array.isArray(parsedStamps)).toBe(true);
    expect(parsedStamps).toHaveLength(2);
    expect(parsedStamps).toEqual(mockStamps);
  });
});
```

### Verification Command Execution
The test script can be run inside the `backend/` directory using:
```bash
npm test
```
This isolates the execution and prints clean coverage metrics.
