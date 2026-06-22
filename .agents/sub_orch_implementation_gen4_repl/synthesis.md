# Synthesis: Milestone 5 - Frontend Core & Services Design

## 1. Consensus Findings
- **Frontend Codebase**: Currently absent; must be initialized from scratch.
- **Angular CLI**: Fully available in environment path (`/home/daniel/.nvm/versions/node/v22.19.0/bin/ng`).
- **Angular Project Settings**:
  - Must use `ng new frontend --routing --standalone=false --style=css --ssr=false --skip-git` to align with the `app.module.ts` and `app-routing.module.ts` requirements in `PROJECT.md` and avoid standalone mode by default.
- **CORS/Proxy Config**:
  - To connect the frontend local development server to the backend Node / mock server running on port 3000 without CORS issues, configure `proxy.conf.json` in the frontend directory.
- **Strict Backend Constraints**:
  - Backend validation strictly verifies numeric types (e.g. `Number.isFinite`). Strings will cause `400 Bad Request`.
  - The `DiveService` must sanitize input fields:
    - Coerce numeric inputs from forms (which are stringified) to numbers or `null`.
    - Trim optional text inputs and convert empty strings (`""`) to `null` to avoid database pollution and backend errors.
    - Map optional/null `stempel` properties to a fallback empty array (`[]`) to prevent client-side template crashes.
- **OCR State Management**:
  - Introduce a BehaviorSubject in `DiveService` (`draftDiveSubject`) to temporarily store the draft dive log returned by the OCR upload, allowing decoupling and seamless data transmission between `/upload` and `/verify` routes.

## 2. Directory Structure Design
```
frontend/
├── proxy.conf.json
├── angular.json
├── package.json
└── src/
    └── app/
        ├── components/
        │   ├── upload/
        │   ├── verification/
        │   └── list/
        ├── services/
        │   ├── dive.service.ts
        │   └── dive.service.spec.ts
        ├── app-routing.module.ts
        ├── app-routing.module.spec.ts
        ├── app.component.ts
        ├── app.component.html
        └── app.module.ts
```

## 3. Worker Implementation Strategy
The worker will execute initialization, stub generation, service coding, routing configuration, module imports, spec testing, and build check.
Detailed verification commands will run inside the worker agent, reporting back with unit test results.
