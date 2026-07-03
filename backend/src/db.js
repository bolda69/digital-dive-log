const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const fs = require('fs');
const path = require('path');

let db = null;
let dbPromise = null;
let initializedDbPath = null;
let initLock = Promise.resolve();

/**
 * Initialize the database and ensure tables exist.
 * @param {string} [dbPathOverride] Path to the database file.
 * @returns {Promise<object>} The active database connection instance.
 */
async function initDb(dbPathOverride) {
  const dbPath = dbPathOverride || process.env.DB_PATH || path.join(__dirname, '../dives.db');

  const currentLock = initLock;
  let resolveLock;
  initLock = new Promise(resolve => {
    resolveLock = resolve;
  });

  try {
    await currentLock;

    if (dbPromise && initializedDbPath === dbPath) {
      return dbPromise;
    }

    if (dbPromise) {
      await closeDbInternal();
    }

    initializedDbPath = dbPath;
    dbPromise = (async () => {
      // Ensure directory exists if not an in-memory database
      if (dbPath !== ':memory:') {
        const dir = path.dirname(path.resolve(dbPath));
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      }

      db = await open({
        filename: dbPath,
        driver: sqlite3.Database
      });

      // Enable foreign keys if needed, though not strictly required
      await db.get('PRAGMA foreign_keys = ON');

      // Create dives table if it doesn't exist
      // stempel stores serialized JSON representing stamps array, validated with json_valid and json_type
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
          stempel TEXT CHECK (stempel IS NULL OR (json_valid(stempel) AND json_type(stempel) = 'array')),
          created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
        )
      `);

      return db;
    })();

    try {
      return await dbPromise;
    } catch (error) {
      dbPromise = null;
      initializedDbPath = null;
      throw error;
    }
  } finally {
    resolveLock();
  }
}

/**
 * Internal close helper that runs within locks or setup.
 */
async function closeDbInternal() {
  if (db) {
    await db.close();
    db = null;
  }
  dbPromise = null;
  initializedDbPath = null;
}

/**
 * Close the current database connection.
 */
async function closeDb() {
  const currentLock = initLock;
  let resolveLock;
  initLock = new Promise(resolve => {
    resolveLock = resolve;
  });

  try {
    await currentLock;
    await closeDbInternal();
  } finally {
    resolveLock();
  }
}

/**
 * Helper to return the current database connection reference.
 */
function getDb() {
  return db;
}

/**
 * Insert a new dive record. Automatically stringifies stempel if it is an array or object.
 * @param {object} dive The dive record data.
 * @returns {Promise<object>} The inserted dive record with parsed stempel.
 */
async function insertDive(dive) {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }

  let stempelValue = null;
  if (dive.stempel !== undefined && dive.stempel !== null) {
    if (Array.isArray(dive.stempel)) {
      stempelValue = JSON.stringify(dive.stempel);
    } else if (typeof dive.stempel === 'string') {
      try {
        const parsed = JSON.parse(dive.stempel);
        if (!Array.isArray(parsed)) {
          throw new Error('stempel must be a JSON array representation');
        }
        stempelValue = JSON.stringify(parsed);
      } catch (e) {
        throw new Error('stempel must be a valid JSON array string: ' + e.message);
      }
    } else {
      throw new Error('stempel must be an array or a valid JSON array string');
    }
  }

  const query = `
    INSERT INTO dives (
      tauchgang_nr, ort, datum, sicht, gewicht_kg, dauer_min,
      tiefe_m, temperatur_c, stroemung, unterschrift_partner, stempel, bemerkungen
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const result = await db.run(query, [
    dive.tauchgang_nr !== undefined ? dive.tauchgang_nr : null,
    dive.ort !== undefined ? dive.ort : null,
    dive.datum !== undefined ? dive.datum : null,
    dive.sicht !== undefined ? dive.sicht : null,
    dive.gewicht_kg !== undefined ? dive.gewicht_kg : null,
    dive.dauer_min !== undefined ? dive.dauer_min : null,
    dive.tiefe_m !== undefined ? dive.tiefe_m : null,
    dive.temperatur_c !== undefined ? dive.temperatur_c : null,
    dive.stroemung !== undefined ? dive.stroemung : null,
    dive.unterschrift_partner !== undefined ? dive.unterschrift_partner : null,
    stempelValue,
    dive.bemerkungen !== undefined ? dive.bemerkungen : null
  ]);

  return await getDiveById(result.lastID);
}

/**
 * Retrieve a dive record by its ID. Automatically parses stempel back into a JS array/object.
 * @param {number} id The dive ID.
 * @returns {Promise<object|undefined>} The dive record, or undefined if not found.
 */
async function getDiveById(id) {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }

  const row = await db.get('SELECT * FROM dives WHERE id = ?', [id]);
  if (row && row.stempel) {
    try {
      row.stempel = JSON.parse(row.stempel);
    } catch (e) {
      // Keep as string if parsing fails
    }
  }
  return row;
}

/**
 * Retrieve all dive records. Automatically parses stempel back into JS array/object.
 * @returns {Promise<Array<object>>} List of dive records.
 */
async function getAllDives() {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }

  const rows = await db.all('SELECT * FROM dives ORDER BY id DESC');
  return rows.map(row => {
    if (row && row.stempel) {
      try {
        row.stempel = JSON.parse(row.stempel);
      } catch (e) {
        // Keep as string if parsing fails
      }
    }
    return row;
  });
}

/**
 * Update an existing dive record by ID.
 * @param {number} id - The dive ID to update.
 * @param {object} dive - The updated dive fields.
 * @returns {Promise<object|null>} The updated dive record, or null if not found.
 */
async function updateDive(id, dive) {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }

  let stempelValue = null;
  if (dive.stempel !== undefined && dive.stempel !== null) {
    if (Array.isArray(dive.stempel)) {
      stempelValue = JSON.stringify(dive.stempel);
    } else if (typeof dive.stempel === 'string') {
      try {
        const parsed = JSON.parse(dive.stempel);
        if (!Array.isArray(parsed)) throw new Error('stempel must be a JSON array');
        stempelValue = JSON.stringify(parsed);
      } catch (e) {
        throw new Error('stempel must be a valid JSON array string: ' + e.message);
      }
    }
  }

  const result = await db.run(`
    UPDATE dives SET
      tauchgang_nr = ?, ort = ?, datum = ?, sicht = ?,
      gewicht_kg = ?, dauer_min = ?, tiefe_m = ?, temperatur_c = ?,
      stroemung = ?, unterschrift_partner = ?, stempel = ?, bemerkungen = ?
    WHERE id = ?`,
    [
      dive.tauchgang_nr !== undefined ? dive.tauchgang_nr : null,
      dive.ort !== undefined ? dive.ort : null,
      dive.datum !== undefined ? dive.datum : null,
      dive.sicht !== undefined ? dive.sicht : null,
      dive.gewicht_kg !== undefined ? dive.gewicht_kg : null,
      dive.dauer_min !== undefined ? dive.dauer_min : null,
      dive.tiefe_m !== undefined ? dive.tiefe_m : null,
      dive.temperatur_c !== undefined ? dive.temperatur_c : null,
      dive.stroemung !== undefined ? dive.stroemung : null,
      dive.unterschrift_partner !== undefined ? dive.unterschrift_partner : null,
      stempelValue,
      dive.bemerkungen !== undefined ? dive.bemerkungen : null,
      id
    ]
  );

  if (result.changes === 0) return null;
  return await getDiveById(id);
}

/**
 * Check if a dive with the same tauchgang_nr OR (same ort + datum) already exists.
 * Used to filter out already-digitized entries when processing a photo.
 *
 * @param {object} dive - The candidate dive object with at least { ort, datum, tauchgang_nr }.
 * @returns {Promise<object|undefined>} The existing record, or undefined if no duplicate found.
 */
async function findExistingDive(dive) {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }

  // Match by dive number if present (most reliable)
  if (dive.tauchgang_nr !== null && dive.tauchgang_nr !== undefined) {
    const byNr = await db.get(
      'SELECT id FROM dives WHERE tauchgang_nr = ?',
      [dive.tauchgang_nr]
    );
    if (byNr) return byNr;
  }

  // Fallback: match by location + date
  if (dive.ort && dive.datum) {
    const byOrtDatum = await db.get(
      'SELECT id FROM dives WHERE ort = ? AND datum = ?',
      [String(dive.ort).trim(), String(dive.datum).trim()]
    );
    if (byOrtDatum) return byOrtDatum;
  }

  return undefined;
}

/**
 * Delete a dive record by ID.
 * @param {number} id - The dive ID to delete.
 * @returns {Promise<boolean>} True if deleted, false if not found.
 */
async function deleteDive(id) {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }

  const result = await db.run('DELETE FROM dives WHERE id = ?', [id]);
  return result.changes > 0;
}

module.exports = {
  initDb,
  closeDb,
  getDb,
  insertDive,
  getDiveById,
  getAllDives,
  findExistingDive,
  updateDive,
  deleteDive
};
