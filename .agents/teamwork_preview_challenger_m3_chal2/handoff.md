# Handoff Report - Milestone 3 Empirical Verification

## Observation

1. In `/home/daniel/IdeaProjects/digital-dive-log/backend/src/routes.js` (lines 74-85), numeric fields are validated as follows:
```js
  const numericFields = ['tauchgang_nr', 'dauer_min', 'tiefe_m', 'gewicht_kg', 'temperatur_c'];
  for (const field of numericFields) {
    const val = req.body[field];
    if (val !== undefined && val !== null) {
      if (typeof val !== 'number' || Number.isNaN(val)) {
        return res.status(400).json({ error: `${field} must be a number` });
      }
      if (val < 0) {
        return res.status(400).json({ error: `${field} cannot be negative` });
      }
    }
  }
```

2. In `/home/daniel/IdeaProjects/digital-dive-log/backend/src/routes.js` (lines 68-71), date validation calculates days in a month using:
```js
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) {
    return res.status(400).json({ error: 'datum must be a valid calendar date' });
  }
```

3. In `/home/daniel/IdeaProjects/digital-dive-log/backend/src/routes.js` (lines 24-36), optional text parameters such as `sicht`, `stroemung`, and `unterschrift_partner` are destructured and passed to the database helper without type validation.

4. Terminal commands (e.g. `npm test`) timed out waiting for approval:
```
Encountered error in step execution: Permission prompt for action 'command' on target 'npm test' timed out waiting for user response. The user was not able to provide permission on time.
```

## Logic Chain

* **Negative Temperature Bug**: 
  1. Water temperature can fall below 0 °C in ice/salt water diving (e.g., -2 °C).
  2. However, `temperatur_c` is included in `numericFields` (Observation 1).
  3. Consequently, any input where `temperatur_c < 0` triggers the validation error `temperatur_c cannot be negative` and returns a `400 Bad Request`.
  4. This blocks valid environmental records.

* **Year 0000 Leap Day Mismatch**:
  1. For the date `0000-02-29`, the parsed year is `0`.
  2. Standard JavaScript `new Date(year, month, 0)` treats years `0` through `99` by prefixing them to `1900`. Thus, `new Date(0, 2, 0)` resolves to March 0th, 1900.
  3. Since 1900 is not a leap year, `getDate()` returns `28` (Observation 2).
  4. The day validator triggers because `29 > 28`, rejecting `0000-02-29` even though Year 0000 (1 BC) is mathematically a leap year.

* **Optional Parameter Pollution**:
  1. Non-string types (e.g., objects like `{ text: "clear" }`) are accepted by the API router for optional fields since there are no type checks.
  2. They are passed directly to `insertDive` and bound as parameters.
  3. The SQLite driver converts them to strings such as `"[object Object]"` upon database insertion, corrupting the stored record text.

## Caveats

- Since execution commands timed out due to headless/non-interactive sandbox permission restrictions, code behavior and assertions were verified statically based on runtime specifications.

## Conclusion

The Milestone 3 Backend API Endpoints implementation contains three primary validation/business logic bugs:
1. **Invalid Numeric Limitation**: `temperatur_c` is incorrectly blocked from being negative, preventing ice-diving temperature entries.
2. **Date Engine Leap Year Quirk**: Year 0000 leap day validation fails due to JS Date object year mapping to 1900.
3. **Weak Parameter Type Safety**: Optional fields bypass type validation, enabling JSON object pollution of database text columns.

## Verification Method

1. Review the newly added test cases in `/home/daniel/IdeaProjects/digital-dive-log/backend/src/routes.test.js`:
   * `should reject negative temperature_c (known business logic limitation/bug)`
   * `should reject year 0000 leap day due to JS Date mapping to 1900 (known edge-case bug)`
   * `should successfully handle non-string values in string fields by converting/storing them (potential lack of API validation)`
   * `should handle concurrent/stress GET requests and return all results`
2. Run the test command in the `backend/` directory:
   ```bash
   npm test
   ```
   All test assertions verify the existing (faulty) behaviors of the API.
