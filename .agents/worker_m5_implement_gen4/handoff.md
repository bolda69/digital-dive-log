# Handoff Report: Milestone 5 — Frontend Core & Services

This report documents the implementation, build, and test verification of the Frontend Core & Services for the Digital Dive Log project.

## 1. Observation

1. **Angular App Initialization**: Running `npx --yes @angular/cli@17 new frontend --routing=true --style=css --standalone=false --ssr=false --skip-git` in the repository root successfully created the `frontend/` directory structure with modular architecture matching the spec.
2. **Components and Service Generation**: 
   - `npx ng generate component components/upload` updated `app.module.ts` and generated:
     - `frontend/src/app/components/upload/upload.component.ts`
     - `frontend/src/app/components/upload/upload.component.html`
     - `frontend/src/app/components/upload/upload.component.spec.ts`
   - `npx ng generate component components/verification` updated `app.module.ts` and generated:
     - `frontend/src/app/components/verification/verification.component.ts`
     - `frontend/src/app/components/verification/verification.component.html`
     - `frontend/src/app/components/verification/verification.component.spec.ts`
   - `npx ng generate component components/list` updated `app.module.ts` and generated:
     - `frontend/src/app/components/list/list.component.ts`
     - `frontend/src/app/components/list/list.component.html`
     - `frontend/src/app/components/list/list.component.spec.ts`
   - `npx ng generate service services/dive` generated:
     - `frontend/src/app/services/dive.service.ts`
     - `frontend/src/app/services/dive.service.spec.ts`
3. **Proxy Setup**: `frontend/proxy.conf.json` was created mapping `/api` to target `http://localhost:3000`. Registered `"proxyConfig": "proxy.conf.json"` under serve options in `frontend/angular.json`.
4. **App Routing Module**:
   - `app-routing.module.ts` was implemented to define routes `/upload`, `/verification`, and `/list` with redirects from `/verify` to `/verification`, from `/dives` to `/list`, from `""` to `/list`, and wildcard `**` to `/list`.
   - `app-routing.module.spec.ts` was implemented to test routing paths and redirects.
5. **App Module Config**: `app.module.ts` was updated to import `HttpClientModule`, `FormsModule`, and `ReactiveFormsModule` from `@angular/common/http` and `@angular/forms`.
6. **Dive Service implementation**:
   - `dive.service.ts` implements shared state (`draftDive$` BehaviorSubject, `getDraftDive()`, `setDraftDive(dive)`), and HTTP API calls (`getDives()`, `saveDive(dive)`, `uploadImage(file)`).
   - Sanitization/Coercion logic was implemented: optional strings are trimmed and converted to `null` if empty; optional numbers/floats are coerced; integers (`tauchgang_nr`, `dauer_min`, `temperatur_c`) are rounded via `Math.round`; `stempel` is verified as an array or fallback to `[]`.
   - `dive.service.spec.ts` contains tests for shared state, uploading file (with FormData), retrieving dives (with `stempel` default array map), and saving dives (verifying numeric coercion and string nullification).
7. **App Component View**: `app.component.html` has been updated to contain only `<router-outlet></router-outlet>`.
8. **Root Package JSON scripts**: Added scripts `"start:frontend": "cd frontend && ng serve"` and `"test:frontend": "cd frontend && ng test --watch=false --browsers=ChromeHeadless"` to the root `package.json`.
9. **Build Results**: Running `npx ng build` inside `frontend/` compiled successfully:
   ```
   Initial chunk files   | Names         |  Raw size | Estimated transfer size
   main-K5D44EAQ.js      | main          | 207.83 kB |                54.83 kB
   polyfills-FFHMD2TL.js | polyfills     |  33.71 kB |                11.02 kB
   styles-5INURTSO.css   | styles        |   0 bytes |                 0 bytes

                         | Initial total | 241.54 kB |                65.84 kB

   Output location: /home/daniel/IdeaProjects/digital-dive-log/frontend/dist/frontend
   Application bundle generation complete. [2.220 seconds]
   ```
10. **Test Verification**:
    - Initially, Karma reported `No binary for ChromeHeadless browser on your platform. Please, set "CHROME_BIN" env variable`.
    - Discovered Playwright's local Chromium binary at `/home/daniel/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`.
    - Running `CHROME_BIN=/home/daniel/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome npm run test:frontend` successfully executed and passed 18/18 Karma unit tests:
      ```
      TOTAL: 18 SUCCESS
      ```

## 2. Logic Chain

1. **Angular Initialization**: The traditional NgModule structure was selected to prevent standalone-by-default conflicts and strictly match the structural guidelines and specs.
2. **Data Sanitization**: Backend SQLite and validation endpoints reject empty strings on numeric types. Form inputs on the web default to string values. Therefore, string-to-number parsing, rounding of integer fields (`tauchgang_nr`, `dauer_min`, `temperatur_c`), and empty-to-null coercion are enforced in `DiveService.prepareForBackend` before payload dispatch.
3. **Draft Log State Management**: Decoupling the `/upload` view (which triggers the OCR endpoint) from the `/verification` view (which displays the form containing OCR outputs) requires shared memory. A reactive `BehaviorSubject` is used in the `DiveService` to hold this transient state, enabling components to subscribe/push updates easily across route navigation.
4. **Environment-safe Testing**: Running tests headlessly inside the restricted sandbox environment requires using the cache-installed Chromium binary provided by the system. Mapping `CHROME_BIN` directly to Playwright's cached browser enables automated test execution without external package installs.
5. **Warning Suppression**: To avoid selector collision warning `NG0912` when compiling multiple mock components within the routing test spec, unique selector attributes were added to each mock component.

## 3. Caveats

- **No browser access**: In CODE_ONLY network mode, external browser dependencies cannot be downloaded. If Playwright's cached chrome binary is deleted or moved, unit test runs will fail unless `CHROME_BIN` is updated to point to another local Chrome/Chromium installation.

## 4. Conclusion

All components, routing rules, redirects, dependencies, mock configuration, proxy options, service endpoints, shared state observables, input sanitizers, and package scripts have been successfully implemented and validated. The app builds cleanly, and 18/18 unit tests pass successfully.

## 5. Verification Method

To verify the implementation independently, execute the following commands:

1. **Verify App Build**:
   ```bash
   cd /home/daniel/IdeaProjects/digital-dive-log/frontend
   npx ng build
   ```
   Ensure it compiles without error.

2. **Verify App Unit Tests**:
   ```bash
   cd /home/daniel/IdeaProjects/digital-dive-log
   CHROME_BIN=/home/daniel/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome npm run test:frontend
   ```
   Verify that all 18 specs pass successfully.

3. **Verify File Layout**:
   Ensure the following files are present and match specifications:
   - `frontend/proxy.conf.json`
   - `frontend/src/app/app-routing.module.ts`
   - `frontend/src/app/app-routing.module.spec.ts`
   - `frontend/src/app/services/dive.service.ts`
   - `frontend/src/app/services/dive.service.spec.ts`
