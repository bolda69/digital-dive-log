const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { initDb, closeDb, getDb, insertDive, getDiveById, getAllDives } = require('./db');

async function runTests() {
  console.log('Starting adversarial verification tests...');
  
  // Initialize in-memory database for testing
  await initDb(':memory:');
  console.log('Database initialized successfully.');

  try {
    // ----------------------------------------
    // 1. SQL Injection Verification
    // ----------------------------------------
    console.log('\n--- 1. SQL Injection Verification ---');
    const maliciousOrt = "Dahab'; DROP TABLE dives; --";
    const sqlInjectionDive = {
      tauchgang_nr: 101,
      ort: maliciousOrt,
      datum: "2026-06-20",
      stempel: ["Stamp1"]
    };
    
    const insertedSqlInj = await insertDive(sqlInjectionDive);
    assert.strictEqual(insertedSqlInj.ort, maliciousOrt, "Malicious string should be stored literally");
    
    // Check table still exists
    const db = getDb();
    const table = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='dives'");
    assert.ok(table, "Table 'dives' should still exist (SQL Injection failed)");
    
    const retrievedSqlInj = await getDiveById(insertedSqlInj.id);
    assert.strictEqual(retrievedSqlInj.ort, maliciousOrt, "Retrieved malicious string should match exactly");
    console.log('Pass: SQL Injection is prevented by SQL parameter binding.');

    // ----------------------------------------
    // 2. Invalid stempel Type Verification
    // ----------------------------------------
    console.log('\n--- 2. Invalid stempel Type Verification ---');
    
    const invalidTypes = [
      true,
      false,
      123,
      { club: "Scuba Club" }
    ];

    for (const invalidType of invalidTypes) {
      try {
        await insertDive({
          ort: "Dahab",
          datum: "2026-06-20",
          stempel: invalidType
        });
        assert.fail(`Should have thrown error for stempel type: ${typeof invalidType}`);
      } catch (err) {
        assert.ok(err.message.includes('stempel must be'), `Expected error message about stempel type, got: ${err.message}`);
      }
    }
    console.log('Pass: Invalid stempel types are rejected at application level.');

    // ----------------------------------------
    // 3. Invalid JSON Array in stempel Verification
    // ----------------------------------------
    console.log('\n--- 3. Invalid JSON Array in stempel ---');
    
    const invalidJsonStrings = [
      "{invalid_json",
      "not_a_json_string",
      '"just_a_string"',
      '{"key": "value"}' // JSON object but not array
    ];

    for (const invalidJson of invalidJsonStrings) {
      try {
        await insertDive({
          ort: "Dahab",
          datum: "2026-06-20",
          stempel: invalidJson
        });
        assert.fail(`Should have thrown error for invalid JSON stempel: ${invalidJson}`);
      } catch (err) {
        assert.ok(
          err.message.includes('stempel must be a JSON array') || err.message.includes('stempel must be a valid JSON array'),
          `Expected JSON array error, got: ${err.message}`
        );
      }
    }

    // Direct DB insertion check to test the SQLite CHECK constraint
    try {
      await db.run(`
        INSERT INTO dives (ort, datum, stempel)
        VALUES (?, ?, ?)
      `, ['DirectDBTest', '2026-06-20', '{"type": "object"}']);
      assert.fail("SQLite CHECK constraint should have rejected non-array JSON object");
    } catch (err) {
      assert.ok(err.message.includes('CHECK constraint failed'), `Expected SQLite CHECK constraint failure, got: ${err.message}`);
    }

    // Verify valid JSON array string works
    const validJsonArrayString = '["Stamp A", "Stamp B"]';
    const insertedValidJsonString = await insertDive({
      ort: "Dahab",
      datum: "2026-06-20",
      stempel: validJsonArrayString
    });
    assert.deepStrictEqual(insertedValidJsonString.stempel, ["Stamp A", "Stamp B"], "JSON array string should be parsed and stored as array");

    console.log('Pass: Invalid JSON arrays are rejected at both application and database level.');

    // ----------------------------------------
    // 4. Extreme Values Verification
    // ----------------------------------------
    console.log('\n--- 4. Extreme Values Verification ---');
    
    // Database layer allows extreme values (normal for SQL DB layer without CHECK constraints)
    const extremeDive = {
      tauchgang_nr: -999,
      ort: "Dahab",
      datum: "2026-06-20",
      gewicht_kg: -50.5,
      dauer_min: -120,
      tiefe_m: -10000.5,
      temperatur_c: -500,
    };
    
    const insertedExtreme = await insertDive(extremeDive);
    assert.strictEqual(insertedExtreme.tauchgang_nr, -999);
    assert.strictEqual(insertedExtreme.gewicht_kg, -50.5);
    assert.strictEqual(insertedExtreme.dauer_min, -120);
    assert.strictEqual(insertedExtreme.tiefe_m, -10000.5);
    assert.strictEqual(insertedExtreme.temperatur_c, -500);
    console.log('Note: Database layer allows negative values natively (expected behavior, range constraints handled by API/Controller).');

    // ----------------------------------------
    // 5. Concurrent Initialization Verification
    // ----------------------------------------
    console.log('\n--- 5. Concurrent Initialization Verification ---');
    
    // Reset database
    await closeDb();
    
    // Run multiple initializations concurrently
    const path1 = ':memory:';
    const path2 = ':memory:';
    
    const p1 = initDb(path1);
    const p2 = initDb(path2);
    
    const [db1, db2] = await Promise.all([p1, p2]);
    
    assert.strictEqual(db1, db2, "Concurrent initialization calls should resolve to the same database connection");
    
    // Verify path resolution doesn't split brain
    const defaultDb = await initDb();
    const resolvedPath = defaultDb.config.filename;
    assert.ok(path.isAbsolute(resolvedPath), "Database path should be absolute");
    assert.ok(resolvedPath.endsWith('dives.db'), "Database file name should be dives.db");
    
    console.log('Pass: Concurrent initialization guard successfully prevents race conditions.');

    console.log('\nAll adversarial tests completed successfully!');

  } catch (error) {
    console.error('Test verification failed:', error);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

runTests();
