# Challenge Report (Handoff) - Milestone 5 Verification

## 1. Observation
We analyzed and verified the frontend core service class in `frontend/src/app/services/dive.service.ts`.

### A. Shared Draft State Propagation
In `frontend/src/app/services/dive.service.ts` (lines 31-32 and 59-65):
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

### B. Coercion and Sanitization (Numeric and String)
In `frontend/src/app/services/dive.service.ts` (lines 93-121):
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

### C. Stempel Array Structure Validation
In `frontend/src/app/services/dive.service.ts` (line 120):
```typescript
stempel: Array.isArray(dive.stempel) ? dive.stempel.filter(s => typeof s === 'string' && s.trim() !== '') : []
```

### D. Unit Test Execution
We executed the unit tests inside `frontend/` using the command:
`CHROME_BIN=/home/daniel/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome npx ng test --watch=false --browsers=ChromeHeadless`
Result:
```
TOTAL: 22 SUCCESS
```

### E. Frontend Build
We executed the build inside `frontend/` using the command:
`npx ng build`
Result:
```
Application bundle generation complete. [2.169 seconds]
```

---

## 2. Logic Chain
1. **Shared State**: By definition, `BehaviorSubject` stores the latest value and replays it to new subscribers immediately. As observed in `dive.service.ts` (lines 31-32), `draftDiveSubject` is a `BehaviorSubject`, meaning subscribers to `draftDive$` will instantly receive the current draft state and any subsequent updates. Our added reactive subscription test verified this behavior correctly.
2. **Coercion of `""` to `null`**: The helpers `coerceNumber` and `coerceString` explicitly check if `String(val).trim() === ''` and return `null`. Therefore, any empty/whitespace inputs in numeric fields (`tauchgang_nr`, `gewicht_kg`, `dauer_min`, `tiefe_m`, `temperatur_c`) or optional text fields (`sicht`, `stroemung`, `unterschrift_partner`) are correctly sanitized to `null` before submission.
3. **Integer Rounding vs. Float Preservation**:
   - `coerceInteger` wraps `coerceNumber` and applies `Math.round(num)` to the result. This applies to `tauchgang_nr`, `dauer_min`, and `temperatur_c`, ensuring decimals are rounded.
   - `coerceNumber` returns the float representation of valid finite numbers directly. This applies to `gewicht_kg` and `tiefe_m`, preserving float decimals (e.g. `8.56`, `22.35`).
4. **Stempel Array Structure Validation**: `Array.isArray(dive.stempel)` ensures any non-array values (e.g. string or null) are replaced with `[]`. If it is an array, the `.filter` expression removes empty/whitespace entries and non-string elements.
5. **Robustness**: The unit tests (including the new adversarial and edge-case suites) all passed, validating the coercion, sanitization, and state behavior under stress conditions.

---

## 3. Caveats
- The view components (`upload.component.ts`, `verification.component.ts`, `list.component.ts`) are currently empty skeletons. The interaction between services and the UI templates will be implemented in Milestone 6, so UI-to-service state synchronization was not reviewed.

---

## 4. Conclusion
The frontend core service (`DiveService`) implementation is robust, correct, and conforms strictly to the requirements and REST API contract. Numerical sanitization, type coercion (including empty inputs to `null`), integer rounding, float preservation, and `stempel` array validation behave exactly as specified. All frontend unit tests and builds compile and pass successfully.

---

## 5. Verification Method
To independently verify:
1. Run the Angular unit test suite:
   ```bash
   cd frontend
   CHROME_BIN=/home/daniel/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome npx ng test --watch=false --browsers=ChromeHeadless
   ```
2. Build the frontend production assets:
   ```bash
   cd frontend
   npx ng build
   ```
3. Inspect `frontend/src/app/services/dive.service.spec.ts` to view the comprehensive adversarial and edge-case test coverage added to confirm these behaviors.
