const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.beforeEach(async ({ request }) => {
  const resetRes = await request.post('/api/mock/reset');
  expect(resetRes.status()).toBe(200);
});

// ==========================================
// TIER 1: Feature Coverage (Tests 1-15)
// ==========================================

test('1. Upload valid PNG image -> returns 200 OK and valid JSON matching the schema', async ({ request }) => {
  const res = await request.post('/api/upload', {
    multipart: {
      image: {
        name: 'standard_log.png',
        mimeType: 'image/png',
        buffer: fs.readFileSync(path.join(__dirname, 'fixtures', 'standard_log.png'))
      }
    }
  });
  expect(res.status()).toBe(200);
  const data = await res.json();
  expect(data.tauchgang_nr).toBe(527);
  expect(data.ort).toBe("Dahab Blue Hole");
  expect(data.datum).toBe("2026-06-20");
});

test('2. Upload valid JPEG image -> returns 200 OK and valid JSON', async ({ request }) => {
  const res = await request.post('/api/upload', {
    multipart: {
      image: {
        name: 'standard_log.jpeg',
        mimeType: 'image/jpeg',
        buffer: fs.readFileSync(path.join(__dirname, 'fixtures', 'standard_log.jpeg'))
      }
    }
  });
  expect(res.status()).toBe(200);
  const data = await res.json();
  expect(data.ort).toBe("Dahab Blue Hole");
});

test('3. Upload valid GIF image -> returns 200 OK and valid JSON', async ({ request }) => {
  const res = await request.post('/api/upload', {
    multipart: {
      image: {
        name: 'standard_log.gif',
        mimeType: 'image/gif',
        buffer: fs.readFileSync(path.join(__dirname, 'fixtures', 'standard_log.gif'))
      }
    }
  });
  expect(res.status()).toBe(200);
  const data = await res.json();
  expect(data.ort).toBe("Dahab Blue Hole");
});

test('4. Verify response schema types (tauchgang_nr is number, ort is string, datum is date string, stempel is array)', async ({ request }) => {
  const res = await request.post('/api/upload', {
    multipart: {
      image: {
        name: 'standard_log.png',
        mimeType: 'image/png',
        buffer: fs.readFileSync(path.join(__dirname, 'fixtures', 'standard_log.png'))
      }
    }
  });
  expect(res.status()).toBe(200);
  const data = await res.json();
  expect(typeof data.tauchgang_nr).toBe('number');
  expect(typeof data.ort).toBe('string');
  expect(typeof data.datum).toBe('string');
  expect(Array.isArray(data.stempel)).toBe(true);
});

test('5. Verify response contains nulls for optional fields if simulation suggests it', async ({ request }) => {
  const res = await request.post('/api/upload', {
    multipart: {
      image: {
        name: 'null_optional.png',
        mimeType: 'image/png',
        buffer: fs.readFileSync(path.join(__dirname, 'fixtures', 'null_optional.png'))
      }
    }
  });
  expect(res.status()).toBe(200);
  const data = await res.json();
  expect(data.tauchgang_nr).toBeNull();
  expect(data.sicht).toBeNull();
  expect(data.gewicht_kg).toBeNull();
  expect(data.dauer_min).toBeNull();
  expect(data.tiefe_m).toBeNull();
  expect(data.temperatur_c).toBeNull();
  expect(data.stroemung).toBeNull();
  expect(data.unterschrift_partner).toBeNull();
  expect(data.stempel).toEqual([]);
});

test('6. Save dive with all fields populated -> returns 201 Created and response contains database-assigned fields (id, created_at)', async ({ request }) => {
  const payload = {
    tauchgang_nr: 528,
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
  const res = await request.post('/api/dives', { data: payload });
  expect(res.status()).toBe(201);
  const data = await res.json();
  expect(data.id).toBeDefined();
  expect(typeof data.id).toBe('number');
  expect(data.created_at).toBeDefined();
  expect(typeof data.created_at).toBe('string');
  expect(data.tauchgang_nr).toBe(528);
  expect(data.ort).toBe("Dahab Blue Hole");
});

test('7. Save dive with minimal fields (only ort and datum) -> returns 201 Created', async ({ request }) => {
  const payload = {
    ort: "Shark Reef",
    datum: "2026-06-21"
  };
  const res = await request.post('/api/dives', { data: payload });
  expect(res.status()).toBe(201);
  const data = await res.json();
  expect(data.id).toBeDefined();
  expect(data.ort).toBe("Shark Reef");
  expect(data.datum).toBe("2026-06-21");
  expect(data.tauchgang_nr).toBeNull();
});

test('8. Save dive with very large tauchgang_nr (99999) -> succeeds', async ({ request }) => {
  const payload = {
    tauchgang_nr: 99999,
    ort: "Shark Reef",
    datum: "2026-06-21"
  };
  const res = await request.post('/api/dives', { data: payload });
  expect(res.status()).toBe(201);
  const data = await res.json();
  expect(data.tauchgang_nr).toBe(99999);
});

test('9. Save dive with long text for ort (200 characters) -> succeeds', async ({ request }) => {
  const longOrt = "A".repeat(200);
  const payload = {
    ort: longOrt,
    datum: "2026-06-21"
  };
  const res = await request.post('/api/dives', { data: payload });
  expect(res.status()).toBe(201);
  const data = await res.json();
  expect(data.ort).toBe(longOrt);
});

test('10. Save dive with multiple stamps in stempel array -> succeeds', async ({ request }) => {
  const payload = {
    ort: "Shark Reef",
    datum: "2026-06-21",
    stempel: ["Stamp 1", "Stamp 2", "Stamp 3"]
  };
  const res = await request.post('/api/dives', { data: payload });
  expect(res.status()).toBe(201);
  const data = await res.json();
  expect(data.stempel).toEqual(["Stamp 1", "Stamp 2", "Stamp 3"]);
});

test('11. Retrieve list when empty (call reset then check GET /api/dives, returning the baseline dive)', async ({ request }) => {
  const res = await request.get('/api/dives');
  expect(res.status()).toBe(200);
  const data = await res.json();
  expect(data.length).toBe(1);
  expect(data[0].id).toBe(1);
  expect(data[0].ort).toBe("Dahab Blue Hole");
});

test('12. Retrieve list after saving 1 dive -> list length is baseline + 1', async ({ request }) => {
  const payload = {
    ort: "Thistlegorm",
    datum: "2026-06-21"
  };
  const saveRes = await request.post('/api/dives', { data: payload });
  expect(saveRes.status()).toBe(201);

  const res = await request.get('/api/dives');
  expect(res.status()).toBe(200);
  const data = await res.json();
  expect(data.length).toBe(2);
});

test('13. Retrieve list after saving multiple dives -> list length is updated and contains correct records', async ({ request }) => {
  await request.post('/api/dives', { data: { ort: "Dive A", datum: "2026-06-21" } });
  await request.post('/api/dives', { data: { ort: "Dive B", datum: "2026-06-22" } });

  const res = await request.get('/api/dives');
  expect(res.status()).toBe(200);
  const data = await res.json();
  expect(data.length).toBe(3);
  expect(data[1].ort).toBe("Dive A");
  expect(data[2].ort).toBe("Dive B");
});

test('14. Verify each returned dive in list contains database fields id and created_at', async ({ request }) => {
  await request.post('/api/dives', { data: { ort: "Dive A", datum: "2026-06-21" } });

  const res = await request.get('/api/dives');
  expect(res.status()).toBe(200);
  const data = await res.json();
  for (const dive of data) {
    expect(dive.id).toBeDefined();
    expect(typeof dive.id).toBe('number');
    expect(dive.created_at).toBeDefined();
    expect(typeof dive.created_at).toBe('string');
  }
});

test('15. Verify response header Content-Type is application/json', async ({ request }) => {
  const res = await request.get('/api/dives');
  expect(res.headers()['content-type']).toContain('application/json');
});

// ==========================================
// TIER 2: Boundary & Corner Cases (Tests 16-30)
// ==========================================

test('16. Upload with no file attached -> returns 400 Bad Request', async ({ request }) => {
  const res = await request.post('/api/upload');
  expect(res.status()).toBe(400);
});

test('17. Upload non-image text file -> returns 400 Bad Request', async ({ request }) => {
  const res = await request.post('/api/upload', {
    multipart: {
      image: {
        name: 'text_file.txt',
        mimeType: 'text/plain',
        buffer: fs.readFileSync(path.join(__dirname, 'fixtures', 'text_file.txt'))
      }
    }
  });
  expect(res.status()).toBe(400);
});

test('18. Upload excessively large file (using large_file fixture) -> returns 413 Payload Too Large', async ({ request }) => {
  const res = await request.post('/api/upload', {
    multipart: {
      image: {
        name: 'large_file.png',
        mimeType: 'image/png',
        buffer: fs.readFileSync(path.join(__dirname, 'fixtures', 'large_file.png'))
      }
    }
  });
  expect(res.status()).toBe(413);
});

test('19. Upload empty file -> returns 400 Bad Request', async ({ request }) => {
  const res = await request.post('/api/upload', {
    multipart: {
      image: {
        name: 'empty_file.png',
        mimeType: 'image/png',
        buffer: fs.readFileSync(path.join(__dirname, 'fixtures', 'empty_file.png'))
      }
    }
  });
  expect(res.status()).toBe(400);
});

test('20. Upload unsupported extension (e.g., .pdf) -> returns 400 Bad Request', async ({ request }) => {
  const res = await request.post('/api/upload', {
    multipart: {
      image: {
        name: 'unsupported_file.pdf',
        mimeType: 'application/pdf',
        buffer: fs.readFileSync(path.join(__dirname, 'fixtures', 'unsupported_file.pdf'))
      }
    }
  });
  expect(res.status()).toBe(400);
});

test('21. Save dive with missing required field \'ort\' -> returns 400', async ({ request }) => {
  const payload = {
    datum: "2026-06-20"
  };
  const res = await request.post('/api/dives', { data: payload });
  expect(res.status()).toBe(400);
});

test('22. Save dive with missing required field \'datum\' -> returns 400', async ({ request }) => {
  const payload = {
    ort: "Dahab"
  };
  const res = await request.post('/api/dives', { data: payload });
  expect(res.status()).toBe(400);
});

test('23. Save dive with invalid date format (e.g. "2026/06/20" or "invalid") -> returns 400', async ({ request }) => {
  const payload1 = { ort: "Dahab", datum: "2026/06/20" };
  const res1 = await request.post('/api/dives', { data: payload1 });
  expect(res1.status()).toBe(400);

  const payload2 = { ort: "Dahab", datum: "invalid" };
  const res2 = await request.post('/api/dives', { data: payload2 });
  expect(res2.status()).toBe(400);

  const payload3 = { ort: "Dahab", datum: "2026-06-32" }; // invalid day
  const res3 = await request.post('/api/dives', { data: payload3 });
  expect(res3.status()).toBe(400);
});

test('24. Save dive with negative tauchgang_nr -> returns 400', async ({ request }) => {
  const payload = {
    ort: "Dahab",
    datum: "2026-06-20",
    tauchgang_nr: -1
  };
  const res = await request.post('/api/dives', { data: payload });
  expect(res.status()).toBe(400);
});

test('25. Save dive with negative dauer_min -> returns 400', async ({ request }) => {
  const payload = {
    ort: "Dahab",
    datum: "2026-06-20",
    dauer_min: -5
  };
  const res = await request.post('/api/dives', { data: payload });
  expect(res.status()).toBe(400);
});

test('26. Save dive with negative tiefe_m -> returns 400', async ({ request }) => {
  const payload = {
    ort: "Dahab",
    datum: "2026-06-20",
    tiefe_m: -12.5
  };
  const res = await request.post('/api/dives', { data: payload });
  expect(res.status()).toBe(400);
});

test('27. Save dive with negative gewicht_kg -> returns 400', async ({ request }) => {
  const payload = {
    ort: "Dahab",
    datum: "2026-06-20",
    gewicht_kg: -2.0
  };
  const res = await request.post('/api/dives', { data: payload });
  expect(res.status()).toBe(400);
});

test('28. Save dive with negative temperatur_c -> returns 400', async ({ request }) => {
  const payload = {
    ort: "Dahab",
    datum: "2026-06-20",
    temperatur_c: -4
  };
  const res = await request.post('/api/dives', { data: payload });
  expect(res.status()).toBe(400);
});

test('29. Save dive with invalid type for tauchgang_nr (string) -> returns 400', async ({ request }) => {
  const payload = {
    ort: "Dahab",
    datum: "2026-06-20",
    tauchgang_nr: "527"
  };
  const res = await request.post('/api/dives', { data: payload });
  expect(res.status()).toBe(400);
});

test('30. Save dive with malformed JSON body -> returns 400', async ({ request }) => {
  const res = await request.post('/api/dives', {
    headers: {
      'Content-Type': 'application/json'
    },
    data: "{ malformed json "
  });
  expect(res.status()).toBe(400);
});

// ==========================================
// TIER 3: Cross-Feature Combinations (Tests 31-33)
// ==========================================

test('31. Upload -> Save: upload an image, modify some fields in the returned JSON, then send that payload to POST /api/dives. Verify it saves successfully', async ({ request }) => {
  const uploadRes = await request.post('/api/upload', {
    multipart: {
      image: {
        name: 'standard_log.png',
        mimeType: 'image/png',
        buffer: fs.readFileSync(path.join(__dirname, 'fixtures', 'standard_log.png'))
      }
    }
  });
  expect(uploadRes.status()).toBe(200);
  const extracted = await uploadRes.json();

  // Modify fields
  extracted.ort = "Ras Mohammed";
  extracted.tauchgang_nr = 600;

  const saveRes = await request.post('/api/dives', { data: extracted });
  expect(saveRes.status()).toBe(201);
  const saved = await saveRes.json();
  expect(saved.id).toBeDefined();
  expect(saved.ort).toBe("Ras Mohammed");
  expect(saved.tauchgang_nr).toBe(600);
});

test('32. Save -> List: POST a new dive, then GET the list, and verify the response includes the new dive with correct details', async ({ request }) => {
  const payload = {
    tauchgang_nr: 101,
    ort: "Blue Corner",
    datum: "2026-06-22",
    sicht: "30m"
  };
  const saveRes = await request.post('/api/dives', { data: payload });
  expect(saveRes.status()).toBe(201);
  const saved = await saveRes.json();

  const listRes = await request.get('/api/dives');
  expect(listRes.status()).toBe(200);
  const list = await listRes.json();
  
  const found = list.find(d => d.id === saved.id);
  expect(found).toBeDefined();
  expect(found.ort).toBe("Blue Corner");
  expect(found.sicht).toBe("30m");
});

test('33. Upload -> Save -> List: Full chain', async ({ request }) => {
  const uploadRes = await request.post('/api/upload', {
    multipart: {
      image: {
        name: 'standard_log.png',
        mimeType: 'image/png',
        buffer: fs.readFileSync(path.join(__dirname, 'fixtures', 'standard_log.png'))
      }
    }
  });
  expect(uploadRes.status()).toBe(200);
  const extracted = await uploadRes.json();

  const saveRes = await request.post('/api/dives', { data: extracted });
  expect(saveRes.status()).toBe(201);
  const saved = await saveRes.json();

  const listRes = await request.get('/api/dives');
  expect(listRes.status()).toBe(200);
  const list = await listRes.json();

  const found = list.find(d => d.id === saved.id);
  expect(found).toBeDefined();
  expect(found.ort).toBe("Dahab Blue Hole");
  expect(found.tauchgang_nr).toBe(527);
});

// ==========================================
// TIER 4: Real-World Application Scenarios (Tests 34-38)
// ==========================================

test('34. Scenario 1: Standard Dive Logging Journey', async ({ request }) => {
  const up = await request.post('/api/upload', {
    multipart: {
      image: {
        name: 'standard_log.png',
        mimeType: 'image/png',
        buffer: fs.readFileSync(path.join(__dirname, 'fixtures', 'standard_log.png'))
      }
    }
  });
  expect(up.status()).toBe(200);
  const extracted = await up.json();

  const save = await request.post('/api/dives', { data: extracted });
  expect(save.status()).toBe(201);
  const saved = await save.json();

  const list = await (await request.get('/api/dives')).json();
  const matched = list.find(d => d.id === saved.id);
  expect(matched).toBeDefined();
  expect(matched.ort).toBe("Dahab Blue Hole");
});

test('35. Scenario 2: Manual Correction Journey', async ({ request }) => {
  const up = await request.post('/api/upload', {
    multipart: {
      image: {
        name: 'standard_log.png',
        mimeType: 'image/png',
        buffer: fs.readFileSync(path.join(__dirname, 'fixtures', 'standard_log.png'))
      }
    }
  });
  expect(up.status()).toBe(200);
  const extracted = await up.json();

  // Correct OCR errors manually
  extracted.ort = "Dahab Blue Hole - Bells entry";
  extracted.sicht = "25m";

  const save = await request.post('/api/dives', { data: extracted });
  expect(save.status()).toBe(201);
  const saved = await save.json();

  const list = await (await request.get('/api/dives')).json();
  const matched = list.find(d => d.id === saved.id);
  expect(matched).toBeDefined();
  expect(matched.ort).toBe("Dahab Blue Hole - Bells entry");
  expect(matched.sicht).toBe("25m");
});

test('36. Scenario 3: Multi-Dive Batch Logging', async ({ request }) => {
  // Dive 1
  const up1 = await (await request.post('/api/upload', {
    multipart: {
      image: {
        name: 'standard_log.png',
        mimeType: 'image/png',
        buffer: fs.readFileSync(path.join(__dirname, 'fixtures', 'standard_log.png'))
      }
    }
  })).json();
  up1.tauchgang_nr = 10;
  const d1 = await (await request.post('/api/dives', { data: up1 })).json();

  // Dive 2
  const d2 = await (await request.post('/api/dives', {
    data: {
      tauchgang_nr: 11,
      ort: "El Fanadir",
      datum: "2026-06-21"
    }
  })).json();

  // Dive 3
  const up3 = await (await request.post('/api/upload', {
    multipart: {
      image: {
        name: 'null_optional.png',
        mimeType: 'image/png',
        buffer: fs.readFileSync(path.join(__dirname, 'fixtures', 'null_optional.png'))
      }
    }
  })).json();
  up3.tauchgang_nr = 12;
  const d3 = await (await request.post('/api/dives', { data: up3 })).json();

  const list = await (await request.get('/api/dives')).json();
  const ids = list.map(d => d.id);
  expect(ids).toContain(d1.id);
  expect(ids).toContain(d2.id);
  expect(ids).toContain(d3.id);

  const record1 = list.find(d => d.id === d1.id);
  const record2 = list.find(d => d.id === d2.id);
  const record3 = list.find(d => d.id === d3.id);

  expect(record1.tauchgang_nr).toBe(10);
  expect(record2.ort).toBe("El Fanadir");
  expect(record3.tauchgang_nr).toBe(12);
});

test('37. Scenario 4: Recovery from Invalid Input', async ({ request }) => {
  const invalidPayload = {
    ort: "Canyon",
    datum: "invalid-date",
    tiefe_m: -15
  };

  const res1 = await request.post('/api/dives', { data: invalidPayload });
  expect(res1.status()).toBe(400);

  const validPayload = {
    ...invalidPayload,
    datum: "2026-06-22",
    tiefe_m: 15
  };

  const res2 = await request.post('/api/dives', { data: validPayload });
  expect(res2.status()).toBe(201);
  const saved = await res2.json();

  const list = await (await request.get('/api/dives')).json();
  const matched = list.find(d => d.id === saved.id);
  expect(matched).toBeDefined();
  expect(matched.datum).toBe("2026-06-22");
  expect(matched.tiefe_m).toBe(15);
});

test('38. Scenario 5: Full System Integration and Stamp Extraction', async ({ request }) => {
  const extracted = await (await request.post('/api/upload', {
    multipart: {
      image: {
        name: 'standard_log.png',
        mimeType: 'image/png',
        buffer: fs.readFileSync(path.join(__dirname, 'fixtures', 'standard_log.png'))
      }
    }
  })).json();

  expect(extracted.stempel).toEqual(["Scuba Club Dahab", "2026-06-20"]);
  expect(extracted.unterschrift_partner).toBe("John Doe");

  const saved = await (await request.post('/api/dives', { data: extracted })).json();

  const list = await (await request.get('/api/dives')).json();
  const found = list.find(d => d.id === saved.id);
  expect(found).toBeDefined();
  expect(found.stempel).toEqual(["Scuba Club Dahab", "2026-06-20"]);
  expect(found.unterschrift_partner).toBe("John Doe");
});
