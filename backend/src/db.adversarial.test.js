const { initDb, closeDb, getDb, insertDive, getDiveById, getAllDives } = require('./db');

describe('Database Adversarial and Edge Case Tests', () => {
  beforeEach(async () => {
    // Use an in-memory database for testing
    await initDb(':memory:');
  });

  afterEach(async () => {
    await closeDb();
  });

  // 1. SQL Injection Checks
  test('SQL injection payloads in text fields are stored literally and do not execute', async () => {
    const maliciousOrt = "Dahab'; DROP TABLE dives; --";
    const diveData = {
      tauchgang_nr: 1,
      ort: maliciousOrt,
      datum: "2026-06-20",
      stempel: ["Stamp"]
    };

    const inserted = await insertDive(diveData);
    expect(inserted).toBeDefined();
    expect(inserted.ort).toBe(maliciousOrt);

    // Verify table 'dives' still exists (DROP TABLE did not execute)
    const db = getDb();
    const table = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='dives'");
    expect(table).toBeDefined();

    // Verify we can retrieve it
    const retrieved = await getDiveById(inserted.id);
    expect(retrieved.ort).toBe(maliciousOrt);
  });

  // 2. stempel column validation (JSON constraint)
  test('Inserting invalid JSON string as stempel throws an error', async () => {
    const diveData = {
      tauchgang_nr: 2,
      ort: "Dahab",
      datum: "2026-06-20",
      stempel: "{invalid_json: true" // invalid string format (no quotes on keys/values, missing brace)
    };

    await expect(insertDive(diveData)).rejects.toThrow();
  });

  test('Inserting raw unquoted string as stempel throws an error because it is not valid JSON', async () => {
    const diveData = {
      tauchgang_nr: 3,
      ort: "Dahab",
      datum: "2026-06-20",
      stempel: "just_a_string" // unquoted string is not valid JSON in SQLite json_valid()
    };

    await expect(insertDive(diveData)).rejects.toThrow();
  });

  test('Inserting a valid double-quoted JSON string that is not an array as stempel is rejected', async () => {
    const diveData = {
      tauchgang_nr: 4,
      ort: "Dahab",
      datum: "2026-06-20",
      stempel: '"valid_json_string"' // valid JSON string representation (double-quoted) but not an array
    };

    await expect(insertDive(diveData)).rejects.toThrow();
  });

  test('Inserting an object (non-array) as stempel is rejected', async () => {
    const diveData = {
      tauchgang_nr: 5,
      ort: "Dahab",
      datum: "2026-06-20",
      stempel: { club: "Blue Hole Club", date: "2026-06-20" }
    };

    await expect(insertDive(diveData)).rejects.toThrow();
  });

  // 3. Type validations and dynamic typing in SQLite
  test('SQLite accepts non-numeric types for numeric columns due to dynamic typing (lack of strict schema checks)', async () => {
    const diveData = {
      tauchgang_nr: "five", // Expected: INTEGER
      ort: "Dahab",
      datum: "2026-06-20",
      gewicht_kg: "heavy",  // Expected: REAL
      dauer_min: true,      // Expected: INTEGER
      tiefe_m: { value: 10 } // Expected: REAL
    };

    // SQLite doesn't strictly validate types natively unless STRICT tables are used.
    // Let's see what happens.
    // Note: { value: 10 } might fail if SQLite driver converts it to string '[object Object]' or fails to bind.
    // We'll test with a string or boolean first.
    const diveDataBasic = {
      tauchgang_nr: "five",
      ort: "Dahab",
      gewicht_kg: "heavy",
      dauer_min: "forty-five"
    };

    const inserted = await insertDive(diveDataBasic);
    expect(inserted).toBeDefined();
    expect(inserted.tauchgang_nr).toBe("five"); // stored as text!
    expect(inserted.gewicht_kg).toBe("heavy"); // stored as text!
    expect(inserted.dauer_min).toBe("forty-five"); // stored as text!
  });

  // 4. Extreme Values / Logical Constraints
  test('DB accepts physically impossible / extreme values without validation errors', async () => {
    const diveData = {
      tauchgang_nr: -999,
      ort: "Dahab",
      datum: "2026-06-20",
      gewicht_kg: -50.5,     // negative weight
      dauer_min: -120,       // negative duration
      tiefe_m: -10000.5,     // negative depth (above sea level?)
      temperatur_c: -500,    // below absolute zero (-273.15 C)
    };

    const inserted = await insertDive(diveData);
    expect(inserted).toBeDefined();
    expect(inserted.tauchgang_nr).toBe(-999);
    expect(inserted.gewicht_kg).toBe(-50.5);
    expect(inserted.dauer_min).toBe(-120);
    expect(inserted.tiefe_m).toBe(-10000.5);
    expect(inserted.temperatur_c).toBe(-500);
  });

  test('DB handles extremely large numbers', async () => {
    const diveData = {
      tauchgang_nr: 999999999999999,
      ort: "Dahab",
      datum: "2026-06-20",
      gewicht_kg: 1.7976931348623157e+308, // Max double
      dauer_min: 999999999,
    };

    const inserted = await insertDive(diveData);
    expect(inserted).toBeDefined();
    expect(inserted.tauchgang_nr).toBe(999999999999999);
    expect(inserted.gewicht_kg).toBe(1.7976931348623157e+308);
    expect(inserted.dauer_min).toBe(999999999);
  });

  test('DB handles very large text inputs without crashing', async () => {
    const hugeString = "A".repeat(1024 * 1024); // 1 MB string
    const diveData = {
      tauchgang_nr: 1,
      ort: hugeString,
      datum: "2026-06-20"
    };

    const inserted = await insertDive(diveData);
    expect(inserted).toBeDefined();
    expect(inserted.ort).toBe(hugeString);
  });
});
