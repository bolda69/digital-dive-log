# Milestone 6 Handoff: Frontend View Components Design & Plan

## 1. Observation

During the exploration of the frontend codebase in `digital-dive-log`, the following characteristics and files were observed:

- **Component Declarations**: The existing components are declared in a non-standalone manner inside `frontend/src/app/app.module.ts`:
  ```typescript
  @NgModule({
    declarations: [
      AppComponent,
      UploadComponent,
      VerificationComponent,
      ListComponent
    ],
    imports: [
      BrowserModule,
      AppRoutingModule,
      HttpClientModule,
      FormsModule,
      ReactiveFormsModule
    ],
  ```
- **Routing Configuration**: The application routing module `frontend/src/app/app-routing.module.ts` defines the pathways for the application:
  ```typescript
  export const routes: Routes = [
    { path: 'upload', component: UploadComponent },
    { path: 'verification', component: VerificationComponent },
    { path: 'verify', redirectTo: '/verification', pathMatch: 'full' },
    { path: 'list', component: ListComponent },
    { path: 'dives', redirectTo: '/list', pathMatch: 'full' },
    { path: '', redirectTo: '/list', pathMatch: 'full' },
    { path: '**', redirectTo: '/list' }
  ];
  ```
- **Service Interfaces & State**: The `DiveService` class in `frontend/src/app/services/dive.service.ts` provides the reactive pipeline for sharing state between views via the `draftDiveSubject` and handles value sanitization/coercion:
  ```typescript
  private draftDiveSubject = new BehaviorSubject<DiveDraft | null>(null);
  public draftDive$ = this.draftDiveSubject.asObservable();
  ...
  uploadImage(file: File): Observable<DiveDraft> {
    const formData = new FormData();
    formData.append('image', file, file.name);
    return this.http.post<DiveDraft>(`${this.apiUrl}/upload`, formData).pipe(
      map(draft => this.sanitizeDive(draft)),
      tap(draft => this.setDraftDive(draft))
    );
  }
  ```
- **Backend API Rules**: As observed in `backend/src/routes.js` lines 59–145, strict validations are enforced on fields when creating a new record via `POST /api/dives`:
  - `ort` and `datum` are required non-empty strings.
  - `datum` must be a valid calendar date matching format `YYYY-MM-DD`.
  - Numeric fields `tauchgang_nr`, `dauer_min`, `tiefe_m`, `gewicht_kg`, `temperatur_c` must be non-negative and finite.
  - `tauchgang_nr`, `dauer_min`, and `temperatur_c` must be integers.
  - Optional text fields (`sicht`, `stroemung`, `unterschrift_partner`) must be strings of at most 1000 characters.
  - `stempel` must be an array of strings.

---

## 2. Logic Chain

1. **State Transfer (Upload -> Verification)**:
   - When a user uploads a logbook picture via `UploadComponent`, it invokes `DiveService.uploadImage(file)`.
   - The backend `/api/upload` endpoint processes the image using Gemini OCR. On success, `DiveService` intercepts the returned JSON draft, sanitizes it (handling default nulls or stamps), updates the behavior subject state `draftDive$`, and passes the data forward.
   - Upon successful response, the `UploadComponent` uses Angular's `Router` to redirect the user to `/verification`.

2. **Form Instantiation & Validations (Verification)**:
   - Upon initialization, the `VerificationComponent` queries `DiveService.getDraftDive()` to retrieve the current draft.
   - To prevent database save errors (400 Bad Request), a Reactive Form is constructed with validators replicating backend criteria.
   - A custom validator `calendarDateValidator` parses the date input string to ensure it matches `YYYY-MM-DD` and constitutes a real calendar date (including month limits and leap years).
   - Non-negative validators and integer patterns (`^[0-9]*$`) verify numerical inputs.
   - An interactive chip UI allows the user to append or delete individual stamps in the `stempel` list.
   - When the form is submitted, numerical entries are coerced into number values or null (to avoid empty strings crashing the backend JSON parsing), then `DiveService.saveDive()` is triggered.
   - On success, state is cleared and the router navigates to `/list`.

3. **Display & Interactive Manipulation (List)**:
   - The `ListComponent` triggers `DiveService.getDives()` to pull the full list of dive logs.
   - An interactive sort algorithm processes client-side sorting. It checks typings (handling string comparisons via `localeCompare`, and numeric sorting via subtraction) and accounts for optional null fields.
   - Angular pipes format numbers and dates, ensuring clean representation.

---

## 3. Caveats

- **Visual Styling**: This design relies on standard Tailwind or local CSS configurations. No global styling was assumed.
- **Standalone Mode**: Angular config in `angular.json` uses non-standalone components (`standalone: false`). Implementers should maintain this structure.
- **Execution**: The code has not been run or compiled as this is a read-only investigation. All mock and component classes have been meticulously planned but require verification on compile.

---

## 4. Conclusion

The design plans for Milestone 6 components are fully mapped and detailed. They align with both frontend services (`DiveService`) and backend validation requirements. The implementation strategy will leverage Angular Reactive Forms with precise validations to achieve complete E2E compatibility.

To accelerate implementation, proposed implementation files have been written directly to the agent's workspace:
- `/home/daniel/IdeaProjects/digital-dive-log/.agents/teamwork_preview_explorer_m6_exp2/proposed_upload.component.ts`
- `/home/daniel/IdeaProjects/digital-dive-log/.agents/teamwork_preview_explorer_m6_exp2/proposed_upload.component.html`
- `/home/daniel/IdeaProjects/digital-dive-log/.agents/teamwork_preview_explorer_m6_exp2/proposed_upload.component.spec.ts`
- `/home/daniel/IdeaProjects/digital-dive-log/.agents/teamwork_preview_explorer_m6_exp2/proposed_verification.component.ts`
- `/home/daniel/IdeaProjects/digital-dive-log/.agents/teamwork_preview_explorer_m6_exp2/proposed_verification.component.html`
- `/home/daniel/IdeaProjects/digital-dive-log/.agents/teamwork_preview_explorer_m6_exp2/proposed_verification.component.spec.ts`
- `/home/daniel/IdeaProjects/digital-dive-log/.agents/teamwork_preview_explorer_m6_exp2/proposed_list.component.ts`
- `/home/daniel/IdeaProjects/digital-dive-log/.agents/teamwork_preview_explorer_m6_exp2/proposed_list.component.html`
- `/home/daniel/IdeaProjects/digital-dive-log/.agents/teamwork_preview_explorer_m6_exp2/proposed_list.component.spec.ts`

---

## 5. Verification Method

- **Inspection**: Read and review the proposed files in the agent's folder.
- **Compile Verification**: After writing files to their destination directories (`frontend/src/app/components/<name>/`), run the Angular compiler.
- **Test Command**: Run unit tests from the `frontend/` directory to verify component behavior:
  ```bash
  npm test -- --watch=false
  ```
  or
  ```bash
  ng test --watch=false
  ```

---

## 6. Remaining Work

1. Copy the proposed implementation files over the scaffolded files in `frontend/src/app/components/`.
2. Add necessary component CSS styles (optional or custom) as desired.
3. Run `npm run test` or `ng test` inside `frontend/` to confirm that all tests pass.
4. Perform manual E2E check to verify route flows and user inputs.
