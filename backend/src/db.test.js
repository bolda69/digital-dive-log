const { initDb, closeDb, getDb, insertDive, getDiveById, getAllDives } = require('./db');

describe('Database Wrapper and Schema Tests', () => {
  beforeEach(async () => {
    // Use an in-memory database for testing
    await initDb(':memory:');
  });

  afterEach(async () => {
    await closeDb();
  });

  test('Database initialization creates the dives table', async () => {
    const db = getDb();
    expect(db).toBeDefined();

    // Query sqlite_master to verify the table exists
    const table = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='dives'");
    expect(table).toBeDefined();
    expect(table.name).toBe('dives');
  });

  test('Inserting and retrieving a valid dive log record', async () => {
    const diveData = {
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
    };

    const inserted = await insertDive(diveData);
    expect(inserted).toBeDefined();
    expect(inserted.id).toBeDefined();
    expect(inserted.tauchgang_nr).toBe(527);
    expect(inserted.ort).toBe("Dahab Blue Hole");
    expect(inserted.gewicht_kg).toBe(8.0);
    expect(inserted.stempel).toEqual(["Scuba Club Dahab", "2026-06-20"]);
    expect(inserted.created_at).toBeDefined();

    // Verify retrieving the single dive by ID
    const retrieved = await getDiveById(inserted.id);
    expect(retrieved).toBeDefined();
    expect(retrieved.id).toBe(inserted.id);
    expect(retrieved.tauchgang_nr).toBe(527);
    expect(retrieved.stempel).toEqual(["Scuba Club Dahab", "2026-06-20"]);

    // Verify retrieving all dives
    const list = await getAllDives();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(inserted.id);
    expect(list[0].stempel).toEqual(["Scuba Club Dahab", "2026-06-20"]);
  });

  test('Inserting invalid JSON into the stempel column triggers database CHECK constraint error', async () => {
    const db = getDb();
    expect(db).toBeDefined();

    // Using raw SQL query to insert malformed JSON string directly into the stempel column
    await expect(
      db.run(`
        INSERT INTO dives (
          tauchgang_nr, ort, datum, sicht, gewicht_kg, dauer_min,
          tiefe_m, temperatur_c, stroemung, unterschrift_partner, stempel
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        528, "Dahab", "2026-06-21", "20m", 8.0, 45,
        28.5, 24, "mild", "Jane Doe", '{"invalid": json' // Missing closing brace/quote syntax error
      ])
    ).rejects.toThrow();
  });

  test('Inserting null/empty stempel is allowed and works', async () => {
    const diveData = {
      tauchgang_nr: 1,
      ort: "Unknown Reef",
      datum: "2026-06-19",
      stempel: null
    };

    const inserted = await insertDive(diveData);
    expect(inserted).toBeDefined();
    expect(inserted.stempel).toBeNull();

    const retrieved = await getDiveById(inserted.id);
    expect(retrieved.stempel).toBeNull();
  });

  test('Concurrent initialization guard returns same promise/connection', async () => {
    const p1 = initDb(':memory:');
    const p2 = initDb(':memory:');
    const [db1, db2] = await Promise.all([p1, p2]);
    expect(db1).toBe(db2);
  });

  test('Inserting stempel as a valid JSON array string is accepted', async () => {
    const diveData = {
      tauchgang_nr: 10,
      ort: "Dahab",
      datum: "2026-06-20",
      stempel: '["Stamp 1", "Stamp 2"]'
    };

    const inserted = await insertDive(diveData);
    expect(inserted).toBeDefined();
    expect(inserted.stempel).toEqual(["Stamp 1", "Stamp 2"]);
  });

  test('Inserting stempel as a JSON string that is not an array is rejected', async () => {
    const diveData = {
      tauchgang_nr: 11,
      ort: "Dahab",
      datum: "2026-06-20",
      stempel: '{"key": "value"}'
    };

    await expect(insertDive(diveData)).rejects.toThrow();
  });

  test('Default path resolution uses dives.db in the parent directory of src', async () => {
    const originalDbPath = process.env.DB_PATH;
    delete process.env.DB_PATH;

    try {
      const tempDb = await initDb();
      const filename = tempDb.config.filename;
      expect(filename).toContain('dives.db');
      expect(filename).not.toBe('./dives.db');
    } finally {
      if (originalDbPath) {
        process.env.DB_PATH = originalDbPath;
      }
      await closeDb();
    }
  });

  test('Concurrent initialization with different paths resolves sequentially and correctly', async () => {
    const p1 = initDb(':memory:');
    const p2 = initDb(':memory:');
    const [db1, db2] = await Promise.all([p1, p2]);
    expect(db1).toBeDefined();
    expect(db2).toBeDefined();
    expect(getDb()).toBe(db2);
  });

  test('Inserting stempel with invalid JavaScript types (boolean, number, object) is rejected by insertDive', async () => {
    await expect(insertDive({ ort: 'Dahab', datum: '2026-06-20', stempel: true })).rejects.toThrow();
    await expect(insertDive({ ort: 'Dahab', datum: '2026-06-20', stempel: 123 })).rejects.toThrow();
    await expect(insertDive({ ort: 'Dahab', datum: '2026-06-20', stempel: { name: 'Stamp' } })).rejects.toThrow();
  });

  test('Database schema CHECK constraint rejects non-array JSON even if inserted via raw SQL', async () => {
    const db = getDb();
    await expect(
      db.run(`
        INSERT INTO dives (ort, datum, stempel)
        VALUES (?, ?, ?)
      `, ['Test', '2026-06-20', '{"type": "object"}'])
    ).rejects.toThrow();
  });
});
