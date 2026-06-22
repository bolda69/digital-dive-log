# Challenge & Handoff Report — Milestone 5 (Frontend Core & Services)

This report details the empirical verification and adversarial analysis of the frontend core and service implementation of the Digital Dive Log project.

---

## 1. Observation

### File Paths and Code Inspected
The following files were inspected for correctness, sanitization, and state propagation:
- **Service implementation**: `/home/daniel/IdeaProjects/digital-dive-log/frontend/src/app/services/dive.service.ts`
- **Unit test suite**: `/home/daniel/IdeaProjects/digital-dive-log/frontend/src/app/services/dive.service.spec.ts`

### Verbatim Sanitization & Coercion Code (lines 93–121 in `dive.service.ts`):
```typescript
    const coerceNumber = (val: any): number | null => {
      if (val === undefined || val === null || String(val).trim() === '') return null;
      const num = Number(val);
      return Number.isFinite(num) ? num : null;
    };

    const coerceInteger = (val: any): number | null => {
      const num = coerceNumber(val);
      return num !== null ? Math.round(num) : null;
    };

    const coerceString = (val: any): string | null => {
      if (val === undefined || val === null || String(val).trim() === '') return null;
      return String(val).trim();
    };

    return {
      tauchgang_nr: coerceInteger(dive.tauchgang_nr),
      ort: String(dive.ort || '').trim(),
      datum: String(dive.datum || '').trim(),
      sicht: coerceString(dive.sicht),
      gewicht_kg: coerceNumber(dive.gewicht_kg),
      dauer_min: coerceInteger(dive.dauer_min),
      tiefe_m: coerceNumber(dive.tiefe_m),
      temperatur_c: coerceInteger(dive.temperatur_c),
      stroemung: coerceString(dive.stroemung),
      unterschrift_partner: coerceString(dive.unterschrift_partner),
      stempel: Array.isArray(dive.stempel) ? dive.stempel.filter(s => typeof s === 'string' && s.trim() !== '') : []
    };
```

### Verbatim State Propagation Code (lines 31–32 & 59–65 in `dive.service.ts`):
```typescript
  private draftDiveSubject = new BehaviorSubject<DiveDraft | null>(null);
  public draftDive$ = this.draftDiveSubject.asObservable();
  ...
  setDraftDive(dive: DiveDraft | null): void {
    this.draftDiveSubject.next(dive);
  }

  getDraftDive(): DiveDraft | null {
    return this.draftDiveSubject.value;
  }
```

### Command Execution and Output

#### Unit Test Run
Command:
```bash
CHROME_BIN=/home/daniel/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome npx ng test --watch=false --browsers=ChromeHeadless
```
Result snippet:
```
✔ Browser application bundle generation complete.
22 06 2026 08:29:21.646:INFO [karma-server]: Karma v6.4.4 server started at http://localhost:9876/
Chrome Headless 149.0.0.0 (Linux 0.0.0): Executed 22 of 22 SUCCESS (0.077 secs / 0.056 secs)
TOTAL: 22 SUCCESS
```

#### Production Build Run
Command:
```bash
npx ng build
```
Result snippet:
```
✔ Browser application bundle generation complete.
Initial chunk files   | Names         |  Raw size | Estimated transfer size
main-K5D44EAQ.js      | main          | 207.83 kB |                54.83 kB
polyfills-FFHMD2TL.js | polyfills     |  33.71 kB |                11.02 kB
styles-5INURTSO.css   | styles        |   0 bytes |                 0 bytes

                      | Initial total | 241.54 kB |                65.84 kB

Output location: /home/daniel/IdeaProjects/digital-dive-log/frontend/dist/frontend
Application bundle generation complete. [2.128 seconds]
```

---

## 2. Logic Chain

1. **State Propagation**:
   - `draftDiveSubject` (BehaviorSubject) holds the current state of the draft.
   - `draftDive$` exposes the subject as a read-only Observable, permitting reactive notification of updates to UI components.
   - `setDraftDive()` updates the state. When `saveDive()` succeeds, it clears the state by calling `setDraftDive(null)`.
   - `uploadImage()` updates the state with the returned draft by calling `setDraftDive(draft)`.
   - **Conclusion**: Shared draft state propagation behaves exactly as intended, reactively notifying subscribers of new drafts, updates, or clearing.

2. **Numerical Sanitization and Coercion**:
   - Empty input `""` when trimmed yields `""`, matching the condition `String(val).trim() === ''`. Thus, `coerceNumber` and `coerceInteger` correctly return `null`.
   - Float values (e.g. `18.5`) are processed by `coerceNumber` which returns the value itself because `Number.isFinite(18.5)` is true. Therefore, floats are preserved.
   - Integers are processed by `coerceInteger`, which uses `Math.round(num)` on the return value of `coerceNumber(val)`. For example, `101.9` is rounded to `102`.
   - **Conclusion**: Numerical sanitization and coercion logic are robust, handling edge cases without throwing runtime errors.

3. **Array Structure Validation**:
   - `stempel` in `prepareForBackend` is verified with `Array.isArray(dive.stempel)`. If false, it falls back to `[]`.
   - If it is an array, it filters only elements of type `string` that are not whitespace-only: `filter(s => typeof s === 'string' && s.trim() !== '')`.
   - **Conclusion**: This successfully prevents malformed arrays, objects, or empty strings from being transmitted to the backend as part of the `stempel` attribute.

---

## 3. Caveats

- **Asymmetric Validation**: `sanitizeDive` (which cleans backend responses) does not sanitize elements inside the `stempel` array with the same rigour as `prepareForBackend` does. It only checks `Array.isArray(dive.stempel) ? dive.stempel : []`. If the backend returns a non-string or whitespace-only element in `stempel`, it will reside in the frontend's local state until the user saves it again. This is a low-risk asymmetry but should be noted.
- **Javascript Coercion Quirks**: Values like single-element arrays (e.g., `[123]`) passed to number fields would coerce to `123` via `String([123]) => "123"` inside `coerceNumber`. This is standard Javascript coercion behavior, and since type declarations restrict this under TypeScript, it is only possible at runtime via untyped integration or mock bypasses.

---

## 4. Conclusion

The core service implementation in `DiveService` is functionally correct, fully verified by the test suites, and compiles successfully. The implementation incorporates comprehensive unit test coverage targeting edge cases, rounding, float preservation, null coercion, and array filtering.

---

## 5. Verification Method

To verify these results independently:
1. Run unit tests in `frontend/`:
   ```bash
   CHROME_BIN=/home/daniel/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome npx ng test --watch=false --browsers=ChromeHeadless
   ```
2. Verify all 22 specs pass.
3. Run the production build in `frontend/`:
   ```bash
   npx ng build
   ```
4. Verify the build terminates successfully with code 0.

---

## 6. Adversarial Review

### Overall Risk Assessment: LOW

### Challenges

#### [Low] Challenge 1: Asymmetric Sanitization of Backend Data
- **Assumption challenged**: Backend data is always valid or sanitization on retrieval is identical to serialization.
- **Attack scenario**: If the backend returns `stempel: [null, undefined, 42, ""]`, `sanitizeDive` allows it into the local state. A component rendering this array might crash or display blank elements if it expects only non-empty strings.
- **Blast radius**: Local rendering of stamps.
- **Mitigation**: Align `sanitizeDive` to perform the same item-level filtering as `prepareForBackend`.

#### [Low] Challenge 2: JS Type Coercion on Array Inputs to Number Fields
- **Assumption challenged**: Inputs to number fields are either numbers, null, or strings.
- **Attack scenario**: Passing `[25]` as a weight. `String([25])` becomes `"25"`, which `coerceNumber` parses as `25`.
- **Blast radius**: Incorrect coercion of array inputs (though extremely rare due to Angular form controls typing).
- **Mitigation**: Explicitly check `typeof val === 'number' || typeof val === 'string'` inside `coerceNumber`.

### Stress Test Results

- **Input empty string `""` to number field** &rarr; Coerced to `null` &rarr; Verified &rarr; **PASS**
- **Input float `18.5` to float field** &rarr; Preserved as `18.5` &rarr; Verified &rarr; **PASS**
- **Input float `101.9` to integer field** &rarr; Rounded to `102` &rarr; Verified &rarr; **PASS**
- **Input non-array `null` or `"string"` to `stempel`** &rarr; Sanitized to `[]` &rarr; Verified &rarr; **PASS**
- **Input invalid items in `stempel` array `[123, "", "Valid"]`** &rarr; Filtered to `["Valid"]` &rarr; Verified &rarr; **PASS**
