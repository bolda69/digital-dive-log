## 2026-06-22T06:08:56Z

You are the Worker for Milestone 5 (Frontend Core & Services) of the Digital Dive Log project.
Your working directory is `/home/daniel/IdeaProjects/digital-dive-log/.agents/worker_m5_implement_gen4`.

Your task is to implement the Frontend Core & Services inside the `frontend/` directory of the repository.
Here are the aggregated Explorer findings and design specs (read `/home/daniel/IdeaProjects/digital-dive-log/.agents/sub_orch_implementation_gen4_repl/synthesis.md` and `/home/daniel/IdeaProjects/digital-dive-log/.agents/teamwork_preview_explorer_m5_exp1/handoff.md` and `/home/daniel/IdeaProjects/digital-dive-log/.agents/teamwork_preview_explorer_m5_exp3/handoff.md` for full design).

Follow these steps exactly:
1. Initialize the Angular app under `frontend/` from root directory by running:
   npx @angular/cli@17 new frontend --routing=true --style=css --standalone=false --ssr=false --skip-git
2. Setup Proxy:
   - Create `frontend/proxy.conf.json`:
     {
       "/api": {
         "target": "http://localhost:3000",
         "secure": false
       }
     }
   - Update `frontend/angular.json` under `projects -> frontend -> architect -> serve -> options` to include `"proxyConfig": "proxy.conf.json"`.
3. Generate Components inside `frontend/`:
   - Run:
     npx ng generate component components/upload
     npx ng generate component components/verification
     npx ng generate component components/list
4. Generate Service:
   - Generate `DiveService` in `frontend/`:
     npx ng generate service services/dive
5. Implement Routing:
   - Edit `frontend/src/app/app-routing.module.ts`:
     Map `/upload` to UploadComponent, `/verification` to VerificationComponent, `/list` to ListComponent, with redirects `/verify` -> `/verification`, `/dives` -> `/list`, `""` -> `/list`, and wildcard `**` -> `/list`.
   - Create `frontend/src/app/app-routing.module.spec.ts` with routing unit tests.
6. Configure App Module:
   - Edit `frontend/src/app/app.module.ts` to include `HttpClientModule`, `FormsModule`, and `ReactiveFormsModule` in the `imports` array, and make sure the generated components are declared.
7. Implement DiveService:
   - Write `DiveService` in `frontend/src/app/services/dive.service.ts` to implement:
     - Shared state: `setDraftDive(dive: DiveDraft | null)`, `getDraftDive(): DiveDraft | null`, `draftDive$` BehaviorSubject observable.
     - HTTP API calls: `getDives()`, `saveDive(dive: DiveDraft)`, `uploadImage(file: File)`.
     - Coercion/Sanitization: Normalize empty spaces/strings `""` to `null` for optional parameters (to avoid backend finite check failures). Round integers (`tauchgang_nr`, `dauer_min`, `temperatur_c`). Convert stamps `stempel` (if null) to an empty array.
   - Write tests in `frontend/src/app/services/dive.service.spec.ts`.
8. Configure App Component View:
   - Edit `frontend/src/app/app.component.html` to place `<router-outlet></router-outlet>`.
9. Update Root package.json Scripts:
   - Add scripts to the root `package.json`:
     - `"start:frontend": "cd frontend && ng serve"`
     - `"test:frontend": "cd frontend && ng test --watch=false --browsers=ChromeHeadless"`
10. Build and Test:
    - Run the tests using `npm run test:frontend` or `npx ng test --watch=false --browsers=ChromeHeadless` inside `frontend/`.
    - Run `npx ng build` inside `frontend/` to verify it compiles.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Please write a handoff report (handoff.md) in your working directory (`/home/daniel/IdeaProjects/digital-dive-log/.agents/worker_m5_implement_gen4`) summarizing what was done, what files were created/modified, and the build/test execution output. Notify the parent when complete.
