# Milestone 6 Frontend View Components Handoff Report

## 1. Observation

During read-only exploration of the `digital-dive-log` workspace, the following components and configurations were inspected:

### A. Routing Configuration (`frontend/src/app/app-routing.module.ts`)
The routes are already scaffolded as follows:
```typescript
7: export const routes: Routes = [
8:   { path: 'upload', component: UploadComponent },
9:   { path: 'verification', component: VerificationComponent },
10:   { path: 'verify', redirectTo: '/verification', pathMatch: 'full' },
11:   { path: 'list', component: ListComponent },
12:   { path: 'dives', redirectTo: '/list', pathMatch: 'full' },
13:   { path: '', redirectTo: '/list', pathMatch: 'full' },
14:   { path: '**', redirectTo: '/list' }
15: ];
```

### B. DiveService Implementation (`frontend/src/app/services/dive.service.ts`)
The service defines interface contracts and state management methods:
```typescript
6: export interface DiveDraft {
7:   tauchgang_nr: number | null;
8:   ort: string;
9:   datum: string;
10:   sicht: string | null;
11:   gewicht_kg: number | null;
12:   dauer_min: number | null;
13:   tiefe_m: number | null;
14:   temperatur_c: number | null;
15:   stroemung: string | null;
16:   unterschrift_partner: string | null;
17:   stempel: string[];
18: }
```
Key methods observed:
- `uploadImage(file: File)`: POSTs to `/api/upload`, calls `sanitizeDive`, and runs `tap(draft => this.setDraftDive(draft))`.
- `saveDive(dive: DiveDraft)`: Prepares the draft via `prepareForBackend` (coercing strings and rounding integers) and POSTs to `/api/dives`, then clears the draft via `setDraftDive(null)`.
- `getDives()`: GETs `/api/dives` and returns sanitized dives.
- `getDraftDive()` and `setDraftDive()`: Access and update the current `DiveDraft` in memory via a BehaviorSubject.

### C. Backend API Routes Validation Rules (`backend/src/routes.js`)
The backend imposes strict validation parameters on dive entries:
- **Required Fields**: `ort` and `datum` are required, non-empty, and `ort` must be $\le 1000$ characters.
- **Date Format**: Matches `/^\d{4}-\d{2}-\d{2}$/` and must be a valid calendar day of the Gregorian calendar.
- **Numeric Fields**: `tauchgang_nr`, `dauer_min`, `tiefe_m`, `gewicht_kg`, `temperatur_c` must be finite numbers, non-negative, and $\le 100000$.
- **Integer Constraints**: `tauchgang_nr`, `dauer_min`, and `temperatur_c` must be integers.
- **Trench Limit**: `tiefe_m` must be $\le 11000$ ("deeper than the Mariana Trench").
- **Optional Text Fields**: `sicht`, `stroemung`, `unterschrift_partner` must be strings and $\le 1000$ characters.
- **Stempel**: Must be an array of strings.

### D. Component Skeletons
The components in `frontend/src/app/components/` (upload, verification, list) are currently empty classes with default `p works!` HTML templates.

---

## 2. Logic Chain

1. **UploadComponent Flow**:
   - The user selects a file. The component must check the file locally to provide immediate feedback.
   - Using backend constraints as a guide, client-side validation will intercept files that are larger than 10MB or not of type `image/*` (PNG, JPEG, GIF) and block the API call, setting a descriptive `errorMessage`.
   - On selecting a valid image, a `FileReader` reads the image into `imagePreviewUrl` so the user can verify they chose the correct logbook page.
   - On clicking "Upload", `DiveService.uploadImage` is executed. The service maps the response, stores the returned `DiveDraft` in the `draftDiveSubject` state, and returns the observable. Upon successful subscription, the component redirects the user to `/verification`.

2. **VerificationComponent Flow**:
   - On loading, the component checks `DiveService.getDraftDive()`. If no draft exists, the user is navigated to `/upload` as they cannot verify non-existent data.
   - The component will construct a Reactive Form (`FormGroup`) corresponding to the fields in `DiveDraft`.
   - To match backend expectations, validators must be added:
     - `Validators.required` and custom trimming on `ort`.
     - Regex pattern check `/^\d{4}-\d{2}-\d{2}$/` and calendar validation (leap years, month sizes) on `datum`.
     - `Validators.min(0)` and `Validators.max(100000)` on all numeric inputs.
     - Custom integer-only check (e.g. `pattern(/^\d+$/)`) on `tauchgang_nr`, `dauer_min`, and `temperatur_c`.
     - `Validators.max(11000)` on `tiefe_m`.
   - For `stempel`, because it is a variable-length list of strings, it must be bound to a `FormArray`. The UI will dynamically render an input for each element in the `FormArray`, alongside an "Add Stamp" button (pushes a new control) and a "Remove" button per row (removes the control).
   - Upon clicking "Save", the form values are sanitized (white spaces trimmed, optional empty strings mapped to `null` to align with the backend's optional types, and empty stempel entries removed). `DiveService.saveDive` is called, which handles persistence, resets the draft to `null`, and triggers redirection to `/list`.

3. **ListComponent Flow**:
   - The component fetches logged dives via `DiveService.getDives()`.
   - Data formatting (localizing dates, handling `null` placeholders with `-` or `N/A`, displaying stamps as badges) is handled in the HTML template.
   - To improve usability, local client-side sorting (e.g. by `datum`, `tauchgang_nr`, `ort`) and case-insensitive keyword filtering (filtering by `ort` and `unterschrift_partner`) are implemented in the class to manipulate the rendered array.

---

## 3. Caveats

- **Mock Server Differences**: Playwright tests mock database reset behavior and run using a mock server. Our client-side validations are designed to mirror the backend schema directly. If backend validation constraints are updated without updating the frontend custom validators, forms could fail on the server while passing client-side validation.
- **Image URL Storage**: The backend does not serve the uploaded image; it only processes the raw buffer and returns JSON data. Therefore, the image file itself is only available in memory inside the browser session. If a user refreshes the page on `/verification`, the image preview and the draft state in `DiveService` will be lost, necessitating a redirection back to `/upload`.
- **Browser Context**: Frontend unit tests using Karma failed locally due to a missing `ChromeHeadless` binary in the environment. This is an environment constraint and does not indicate an issue with the Angular workspace structure, which builds successfully under `ng build`.

---

## 4. Conclusion

To complete Milestone 6, the three frontend components must be implemented following a robust design that enforces strict validation rules matching the backend APIs, handles draft state via the `DiveService`, and provides a rich list overview. Below is the detailed implementation plan:

### Implementation Specification

#### A. UploadComponent Implementation Plan
- **TypeScript (`upload.component.ts`)**:
  - Properties: `selectedFile: File | null = null`, `imagePreviewUrl: string | ArrayBuffer | null = null`, `isLoading: boolean = false`, `errorMessage: string | null = null`.
  - Methods:
    - `onFileSelected(event: Event)`: Reads file, checks type (`image/png`, `image/jpeg`, `image/gif`) and size ($\le 10\text{MB}$). Shows preview using `FileReader.readAsDataURL()`.
    - `onUpload()`: Calls `DiveService.uploadImage(file)`, sets `isLoading = true`, handles errors, navigates to `/verification` on success.
    - `cancelSelection()`: Clears properties and resets the file input.
- **HTML Layout (`upload.component.html`)**:
  - Styled drag-and-drop zone or `Select Log Image` button.
  - Image preview panel displaying filename and thumbnail.
  - Action buttons: "Upload" (disabled when `isLoading` or no file) and "Cancel".
  - Loading spinner and error alert banner.

#### B. VerificationComponent Implementation Plan
- **TypeScript (`verification.component.ts`)**:
  - Properties: `diveForm!: FormGroup`, `isSaving: boolean = false`, `errorMessage: string | null = null`.
  - Lifecycle: `ngOnInit()` loads draft. If null, redirects to `/upload`. Otherwise, maps the draft to a `FormGroup` with specific custom validators.
  - Form validation structure:
    ```typescript
    this.diveForm = this.fb.group({
      tauchgang_nr: [draft.tauchgang_nr, [Validators.min(0), Validators.max(100000), integerValidator()]],
      ort: [draft.ort, [Validators.required, Validators.maxLength(1000), noWhitespaceValidator()]],
      datum: [draft.datum, [Validators.required, datePatternValidator(), calendarValidityValidator()]],
      sicht: [draft.sicht, [Validators.maxLength(1000)]],
      gewicht_kg: [draft.gewicht_kg, [Validators.min(0), Validators.max(100000)]],
      dauer_min: [draft.dauer_min, [Validators.min(0), Validators.max(100000), integerValidator()]],
      tiefe_m: [draft.tiefe_m, [Validators.min(0), Validators.max(11000)]], // Mariana Trench constraint
      temperatur_c: [draft.temperatur_c, [Validators.min(0), Validators.max(100000), integerValidator()]],
      stroemung: [draft.stroemung, [Validators.maxLength(1000)]],
      unterschrift_partner: [draft.unterschrift_partner, [Validators.maxLength(1000)]],
      stempel: this.fb.array(draft.stempel.map(s => this.fb.control(s)))
    });
    ```
  - Helper array methods: `addStempel()`, `removeStempel(index)`.
  - Submit `onSubmit()`: Trims strings, maps empty fields to `null`, filters out empty stamps, calls `DiveService.saveDive()`, and navigates to `/list`.
- **HTML Layout (`verification.component.html`)**:
  - Grouped form fields (General, Conditions, Metadata/Stamps).
  - Dynamic listing of stamps with a delete icon next to each control, and a button to append stamps.
  - Input field error messages mapping to specific validator failures (e.g. "Depth cannot exceed 11000m").

#### C. ListComponent Implementation Plan
- **TypeScript (`list.component.ts`)**:
  - Properties: `dives: Dive[] = []`, `filteredDives: Dive[] = []`, `isLoading = false`, `searchTerm = ''`, `sortColumn = 'datum'`, `sortDirection = 'desc'`.
  - Methods:
    - `loadDives()`: Calls `DiveService.getDives()`.
    - `applyFilterAndSort()`: Standard text match on `ort` or `unterschrift_partner`, and sorts items.
    - `toggleSort(column)`: Toggles sort direction and resorts.
- **HTML Layout (`list.component.html`)**:
  - Search bar input.
  - "Log New Dive" navigation button.
  - Tabular layout with sortable header links.
  - Badge list for stamps, localized date pipes, and fallback placeholders (`-`) for null data.

---

## 5. Verification Method

To verify the components and their integration, the following tests and commands should be executed:

### A. Component Logic Tests
Run the Karma/Jasmine frontend tests once a ChromeHeadless binary or alternative runner is configured:
```bash
# In digital-dive-log directory:
npm run test:frontend
```
Alternatively, target specific component tests directly:
```bash
cd frontend && ng test --include=src/app/components/**/*.spec.ts --watch=false --browsers=ChromeHeadless
```

### B. Suggested Unit Test Scenarios
Write unit test specs covering:
1. **Upload Component**:
   - Verify non-image files and files larger than 10MB are rejected prior to service calls.
   - Verify upload service failure displays an error alert.
   - Verify successful service upload saves the draft state and triggers route navigation to `/verification`.
2. **Verification Component**:
   - Verify navigation to `/upload` if no draft is present on init.
   - Verify validation errors trigger on negative numbers, values exceeding 100000, depths exceeding 11000, non-integer inputs on integer fields, and invalid dates (e.g. February 29th on non-leap years).
   - Verify dynamic stempel addition and deletion.
   - Verify submission trims data, sends sanitized payloads (replacing empty strings with `null`), and navigates to `/list`.
3. **List Component**:
   - Verify data is correctly fetched and mapped to the grid.
   - Verify searching by location/buddy updates the table.
   - Verify clicking a table header triggers sorting.
   - Verify null values show appropriate placeholder text.
