# Backend DB Setup Analysis Report (Milestone 2)

This report presents design recommendations for the backend foundation and SQLite database configuration for **Milestone 2 (Backend DB Setup)**.

---

## 1. Project Directory Layout Recommendation

To maintain a clean division between backend, frontend, and E2E test files (per `PROJECT.md` and the E2E setup proposal), we recommend the following structure for the backend package:

```text
digital-dive-log/
├── backend/
│   ├── src/
│   │   ├── app.js          # Express app initialization & middleware configuration
│   │   ├── db.js           # SQLite configuration, table creation, and connection helpers
│   │   └── server.js       # App entry point (loads env, initializes DB, starts listening)
│   ├── tests/
│   │   └── db.test.js      # Unit/integration tests for database & schema
│   ├── .env.example        # Template for environment variables (PORT, DB_PATH)
│   └── package.json        # Backend specific dependencies, devDependencies, and scripts
```

---

## 2. Package Configuration (`backend/package.json`)

To configure the backend package, we recommend using standard Node.js libraries. We introduce `sqlite` and `sqlite3` to provide a clean Promise-based API for database interactions, avoiding nested callback patterns.

### Recommended `package.json` Structure
```json
{
  "name": "digital-dive-log-backend",
  "version": "1.0.0",
  "description": "Backend service for Digital Dive Log (Express + SQLite)",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "test": "jest --runInBand --detectOpenHandles"
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
  "private": true
}
```

### Rationale:
- **`sqlite3`**: The underlying SQLite driver.
- **`sqlite`**: A wrapper providing ES6 Promise methods (e.g. `open`, `db.run`, `db.all`, `db.get`) instead of the default callback-heavy interface.
- **`cors`**: Crucial for enabling communication between the Angular frontend (running on port `4200`) and the Node.js backend (running on port `3000`).
- **`nodemon`**: Enhances DX by automatically restarting the server when code files change.
- **`jest`**: Recommended test runner; `--runInBand` is essential for sequential execution when working with file-based SQLite databases to prevent locking.

---

## 3. Express Application Foundation

We separate Express application setup (`src/app.js`) from the actual HTTP server listener (`src/server.js`). This enables integration testing of routing and middleware logic using `supertest` without binding to real network ports.

### Express App Setup (`backend/src/app.js`)
```javascript
const express = require('express');
const cors = require('cors');

const app = express();

// Standard middleware
app.use(cors());
app.use(express.json());

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

module.exports = app;
```

### Server Entry Point (`backend/src/server.js`)
```javascript
require('dotenv').config();
const app = require('./app');
const { initDB } = require('./db');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../dives.db');

async function startServer() {
  try {
    // Initialize SQLite database and tables
    await initDB(DB_PATH);
    console.log(`Database successfully initialized at: ${DB_PATH}`);

    app.listen(PORT, () => {
      console.log(`Backend server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
```

---

## 4. SQLite Database Configuration and Schema Migration (`backend/src/db.js`)

The `db.js` file handles opening connections, initializing tables, and exporting helpers to reference the active database instance.

### Recommended `backend/src/db.js` Implementation
```javascript
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

let dbInstance = null;

/**
 * Initialize SQLite database connection and run schema creation.
 * @param {string} dbPath - File path to SQLite database or ':memory:'
 */
async function initDB(dbPath) {
  dbInstance = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Enable foreign key constraints in SQLite
  await dbInstance.run('PRAGMA foreign_keys = ON;');

  // Schema setup / Migration logic
  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS dives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tauchgang_nr INTEGER,
      ort TEXT NOT NULL,
      datum TEXT NOT NULL,
      sicht TEXT,
      gewicht_kg REAL,
      dauer_min INTEGER,
      tiefe_m REAL,
      temperatur_c INTEGER,
      stroemung TEXT,
      unterschrift_partner TEXT,
      stempel TEXT DEFAULT '[]',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return dbInstance;
}

/**
 * Get active database connection.
 * @returns {import('sqlite').Database}
 */
function getDB() {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDB(path) first.');
  }
  return dbInstance;
}

/**
 * Safely close database connection (useful for unit testing cleanup).
 */
async function closeDB() {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
}

module.exports = {
  initDB,
  getDB,
  closeDB
};
```

---

## 5. Storage of `stempel` (Stamps) Array in SQLite

The interface contract in `PROJECT.md` specifies that `stempel` is represented as an array of strings in API payloads (e.g., `["Scuba Club Dahab", "2026-06-20"]`). However, SQLite does not support a native array or list type. 

### Recommendation: JSON Text Serialization
Given that `PROJECT.md` dictates a **"Single table `dives` to store structured dive log records,"** a normalized one-to-many junction table violates this constraint. Thus, the optimal approach is to store the array as a serialized JSON string in a `TEXT` column.

#### Write Flow (Serialization)
When inserting a dive, the `stempel` array is serialized to a JSON string using `JSON.stringify()` before executing the `INSERT` query.
```javascript
async function saveDive(diveData) {
  const db = getDB();
  const query = `
    INSERT INTO dives (
      tauchgang_nr, ort, datum, sicht, gewicht_kg, dauer_min,
      tiefe_m, temperatur_c, stroemung, unterschrift_partner, stempel
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  // Default to empty JSON array if no stempel is provided
  const serializedStempel = JSON.stringify(diveData.stempel || []);

  const result = await db.run(query, [
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
    serializedStempel
  ]);
  
  return result.lastID;
}
```

#### Read Flow (Deserialization)
When fetching dive records, the `stempel` column (stored as text) is parsed back into a native JavaScript Array using `JSON.parse()` before returning the data to the controller or route layer.
```javascript
async function getDives() {
  const db = getDB();
  const rows = await db.all('SELECT * FROM dives ORDER BY created_at DESC');

  return rows.map(row => {
    let parsedStempel = [];
    try {
      parsedStempel = JSON.parse(row.stempel || '[]');
    } catch (e) {
      console.error(`Failed to parse stempel for dive ID ${row.id}:`, e);
    }
    return {
      ...row,
      stempel: parsedStempel
    };
  });
}
```

---

## 6. Verification Testing Strategy using Jest

To verify database initialization, schema rules, and array serialization/deserialization logic, we recommend writing automated unit tests using Jest. The test suite should run against an **in-memory database (`:memory:`)** to ensure speed, side-effect isolation, and prevent conflicts in build environments.

### Test File (`backend/tests/db.test.js`)
```javascript
const { initDB, getDB, closeDB } = require('../src/db');

describe('Database Setup & Schema Validation', () => {
  beforeEach(async () => {
    // Spin up a fresh in-memory database instance for each test
    await initDB(':memory:');
  });

  afterEach(async () => {
    // Close the in-memory database to free resources
    await closeDB();
  });

  test('should create the dives table successfully', async () => {
    const db = getDB();

    // Query sqlite_master to verify the presence of the table
    const tables = await db.all(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='dives';"
    );
    expect(tables.length).toBe(1);
    expect(tables[0].name).toBe('dives');
  });

  test('should verify the schema matches all target columns', async () => {
    const db = getDB();

    // Query columns info using PRAGMA
    const columns = await db.all("PRAGMA table_info(dives);");
    const columnMap = {};
    columns.forEach(col => {
      columnMap[col.name] = {
        type: col.type,
        notnull: col.notnull,
        dflt_value: col.dflt_value
      };
    });

    // Check primary key
    expect(columnMap['id']).toBeDefined();
    expect(columnMap['id'].type).toBe('INTEGER');

    // Check mandatory fields
    expect(columnMap['ort']).toBeDefined();
    expect(columnMap['ort'].notnull).toBe(1); // NOT NULL
    
    expect(columnMap['datum']).toBeDefined();
    expect(columnMap['datum'].notnull).toBe(1); // NOT NULL

    // Check serialization field
    expect(columnMap['stempel']).toBeDefined();
    expect(columnMap['stempel'].dflt_value).toBe("'[]'");
    
    // Check optional fields
    const expectedFields = [
      'tauchgang_nr', 'sicht', 'gewicht_kg', 'dauer_min', 
      'tiefe_m', 'temperatur_c', 'stroemung', 'unterschrift_partner', 'created_at'
    ];
    expectedFields.forEach(field => {
      expect(columnMap[field]).toBeDefined();
    });
  });

  test('should verify serialization and deserialization of the stempel array', async () => {
    const db = getDB();

    const sampleDive = {
      tauchgang_nr: 1,
      ort: "Hurghada",
      datum: "2026-06-21",
      sicht: "10m",
      gewicht_kg: 7.5,
      dauer_min: 50,
      tiefe_m: 18.0,
      temperatur_c: 26,
      stroemung: "none",
      unterschrift_partner: "John",
      stempel: ["Center-Hurghada", "Instructor-Paul"]
    };

    // Serialize and insert
    const insertQuery = `
      INSERT INTO dives (
        tauchgang_nr, ort, datum, sicht, gewicht_kg, dauer_min,
        tiefe_m, temperatur_c, stroemung, unterschrift_partner, stempel
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    const result = await db.run(insertQuery, [
      sampleDive.tauchgang_nr,
      sampleDive.ort,
      sampleDive.datum,
      sampleDive.sicht,
      sampleDive.gewicht_kg,
      sampleDive.dauer_min,
      sampleDive.tiefe_m,
      sampleDive.temperatur_c,
      sampleDive.stroemung,
      sampleDive.unterschrift_partner,
      JSON.stringify(sampleDive.stempel)
    ]);

    expect(result.lastID).toBe(1);

    // Retrieve raw row
    const row = await db.get("SELECT * FROM dives WHERE id = ?;", [result.lastID]);
    expect(row).toBeDefined();
    
    // Confirm raw format in SQLite is a JSON string
    expect(typeof row.stempel).toBe('string');
    expect(row.stempel).toBe('["Center-Hurghada","Instructor-Paul"]');

    // Deserialize and check
    const deserializedStempel = JSON.parse(row.stempel);
    expect(Array.isArray(deserializedStempel)).toBe(true);
    expect(deserializedStempel).toEqual(sampleDive.stempel);
  });

  test('should enforce NOT NULL constraints on ort and datum', async () => {
    const db = getDB();

    const insertQuery = `
      INSERT INTO dives (tauchgang_nr, sicht) VALUES (?, ?);
    `;

    // Attempting to insert without 'ort' and 'datum' should fail
    await expect(db.run(insertQuery, [5, "20m"])).rejects.toThrow();
  });
});
```

---

## 7. Migration Setup Strategy

For Milestone 2, inline initialization logic in `db.js` using `CREATE TABLE IF NOT EXISTS` provides a simple, zero-configuration setup that starts the application instantly.

### Multi-Milestone Migration Advice:
If future milestones introduce schema evolution:
1. Incorporate a migration directory (e.g. `backend/migrations/`).
2. Run standard migration scripts programmatically upon connection start using SQLite's `migrate` API (which is supported natively by the `sqlite` NPM package):
   ```javascript
   // Recommended upgrade when moving to production/complex schema
   await dbInstance.migrate({
     migrationsPath: path.join(__dirname, '../migrations')
   });
   ```
This provides forward compatibility with future requirements while maintaining an entry-level SQLite configuration for immediate E2E integration testing.
