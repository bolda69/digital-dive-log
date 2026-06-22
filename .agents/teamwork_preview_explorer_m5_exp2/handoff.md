# Handoff Report: Milestone 5 - Frontend Core & Services

## 1. Observation
- **Frontend Codebase Absence**: The root directory `/home/daniel/IdeaProjects/digital-dive-log` does not contain a `frontend` folder. The listing only contains `backend`, `e2e`, `node_modules`, and configuration metadata folders:
  ```json
  {"name":".agents", "isDir":true}
  {"name":".env", "sizeBytes":"61"}
  {"name":"PROJECT.md", "sizeBytes":"6594"}
  {"name":"backend", "isDir":true}
  {"name":"e2e", "isDir":true}
  {"name":"node_modules", "isDir":true}
  {"name":"package.json", "sizeBytes":"458"}
  ```
- **Monorepo Layout**: The root `package.json` does not configure npm workspaces or any monorepo tooling:
  ```json
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.19.2",
    "multer": "^1.4.5-lts.1"
  }
  ```
  This means the Angular app in `frontend/` must be generated and managed as an independent npm module with its own `package.json` and toolchain.
- **Backend API Routes & Port**:
  - `backend/src/server.js:6` listens on port 3000:
    ```javascript
    const PORT = process.env.PORT || 3000;
    ```
  - `backend/src/app.js:20` mounts the backend API routes with prefix `/api`:
    ```javascript
    app.use('/api', routes);
    ```
  - `backend/src/app.js:8` enables CORS globally:
    ```javascript
    app.use(cors());
    ```
- **Backend API Contracts**:
  - `POST /api/upload`: `backend/src/routes.js:20` accepts a single file with field name `image`:
    ```javascript
    const uploadSingle = upload.single('image');
    ```
  - `POST /api/dives`: `backend/src/routes.js:114-124` validates numeric fields:
    ```javascript
    const numericFields = ['tauchgang_nr', 'dauer_min', 'tiefe_m', 'gewicht_kg', 'temperatur_c'];
    const integerFields = ['tauchgang_nr', 'dauer_min', 'temperatur_c'];
    for (const field of numericFields) {
      const val = req.body[field];
      if (val !== undefined && val !== null) {
        if (!Number.isFinite(val)) {
          return res.status(400).json({ error: `${field} must be a finite number` });
        }
    ```
    This means if the frontend sends an empty string `""` for any numeric field (which often happens with standard HTML form inputs when fields are left blank), the backend will throw a `400 Bad Request` because `Number.isFinite("")` is false.
  - `backend/src/routes.js:123-125` validates integers:
    ```javascript
    if (integerFields.includes(field) && !Number.isInteger(val)) {
      return res.status(400).json({ error: `${field} must be an integer` });
    }
    ```
    This means decimals (e.g. `45.2`) sent for `dauer_min` will trigger a validation failure.
  - `backend/src/routes.js:135-144` validates `stempel`:
    ```javascript
    if (stempel !== undefined && stempel !== null) {
      if (!Array.isArray(stempel)) {
        return res.status(400).json({ error: 'stempel must be an array' });
      }
      for (const item of stempel) {
        if (typeof item !== 'string') {
          return res.status(400).json({ error: 'All items in stempel array must be strings' });
        }
      }
    }
    ```
- **Project Structure**: According to `PROJECT.md` lines 52-66, the frontend is expected to use a module-based structure:
  ```
  ├── frontend/
  │   ├── src/
  │   │   ├── app/
  │   │   │   ├── components/
  │   │   │   │   ├── upload/         # Upload view
  │   │   │   │   ├── verification/   # Form editing view
  │   │   │   │   └── list/           # Historical list view
  │   │   │   ├── services/
  │   │   │   │   └── dive.service.ts # HTTP API client
  │   │   │   ├── app.component.ts
  │   │   │   ├── app.module.ts
  │   │   │   └── app-routing.module.ts
  ```

---

## 2. Logic Chain
1. **Frontend Scaffolding**:
   - Since the `frontend` folder is missing, it must be generated from scratch.
   - To match the NgModule structure specified in `PROJECT.md` (which relies on `app.module.ts` and `app-routing.module.ts`), the Angular CLI must be executed with the `--standalone=false` parameter (since Angular CLI 17+ defaults to standalone components).
   - Thus, the proposed command is: `npx @angular/cli@17 new frontend --routing --style=css --standalone=false --ssr=false`.
2. **Components & Services Layout**:
   - The files `UploadComponent`, `VerificationComponent`, `ListComponent`, and `DiveService` need to be generated using the Angular CLI.
3. **Application Routing Design**:
   - We need routing configurations to navigate between the screens.
   - `/upload` maps to `UploadComponent` (step 1: select/upload log image).
   - `/verification` maps to `VerificationComponent` (step 2: view and edit OCR data).
   - `/list` maps to `ListComponent` (step 3: list all saved dives).
   - An empty path `""` and any wildcard path `**` must redirect to `/list` to serve as the default landing view.
4. **DiveService Logic**:
   - **Endpoint Mapping**:
     - `getDives()` performs `GET /api/dives` and returns `Observable<Dive[]>`.
     - `saveDive(dive)` performs `POST /api/dives` and returns `Observable<Dive>`.
     - `uploadImage(file)` performs `POST /api/upload` via `FormData` containing the file under key `'image'`.
   - **OCR Data Handoff (Shared State)**:
     - When `POST /api/upload` returns the extracted OCR data, the application needs to transition from the Upload page to the Verification page and populate the form with this data.
     - To cleanly decouple the views, `DiveService` should store this data in a local variable `extractedDive` (via `setExtractedDive` and `getExtractedDive`), so that `VerificationComponent` can fetch it on load.
   - **Sanitization & Coercion**:
     - Input fields from HTML forms (e.g. `<input type="number">`) frequently bind empty strings `""` to model variables when cleared or left blank.
     - Sending empty strings for numeric fields (`tauchgang_nr`, `dauer_min`, `tiefe_m`, `gewicht_kg`, `temperatur_c`) or passing non-array types for `stempel` violates backend validation rules (causing `400 Bad Request` or validation errors).
     - Therefore, `saveDive(dive)` in `DiveService` must sanitize input payloads: converting empty strings `""` to `null`, rounding float values to integers for integer-constrained fields (`tauchgang_nr`, `dauer_min`, `temperatur_c`), and filtering empty elements out of the `stempel` array.
5. **Testing Strategy**:
   - Unit tests for `DiveService` will mock HTTP requests using `HttpClientTestingModule` and `HttpTestingController` to assert correct URL paths, methods, payload formats, and verification that sanitization/coercion logic is applied before payloads are transmitted.
   - Routing unit tests will utilize `RouterTestingModule` to assert that correct components load for each path and wildcard redirects work.

---

## 3. Caveats
- **Angular Environment**: The strategy proposes Angular CLI 17. If a newer Angular CLI is used, the generator option `--standalone=false` must be verified. If it is deprecated or behaves differently, the worker will need to configure `AppModule` manually.
- **Backend Port & CORS**: The backend listens on `http://localhost:3000`. Because the backend enables CORS globally, the frontend can query it directly in development. Alternatively, configuring an Angular proxy in `proxy.conf.json` enables forwarding `/api` calls directly to `http://localhost:3000` under the same origin (avoiding CORS completely and matching production).
- **Stempel array structure**: Form inputs may pass empty strings for empty stamp elements. The sanitization logic must handle this carefully.

---

## 4. Conclusion
The implementation strategy for Milestone 5 requires:
1. Scaffolding the Angular application in `frontend/` using NgModule conventions.
2. Generating routing configurations in `app-routing.module.ts` linking `/upload`, `/verification`, and `/list` with `/list` as the default fallback.
3. Implementing `DiveService` to manage HTTP calls, hold the shared upload OCR draft, and perform robust client-side sanitization of numeric, integer, and array properties to guarantee compatibility with backend database validation.
4. Implementing unit tests verifying both routing redirects and service endpoints.

---

## 5. Proposed File Structure and Code Templates

### 5.1 Project Layout (Proposed)
```
digital-dive-log/
├── backend/...
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/
│   │   │   │   ├── upload/
│   │   │   │   │   ├── upload.component.ts
│   │   │   │   │   ├── upload.component.html
│   │   │   │   │   └── upload.component.css
│   │   │   │   ├── verification/
│   │   │   │   │   ├── verification.component.ts
│   │   │   │   │   ├── verification.component.html
│   │   │   │   │   └── verification.component.css
│   │   │   │   └── list/
│   │   │   │       ├── list.component.ts
│   │   │   │       ├── list.component.html
│   │   │   │       └── list.component.css
│   │   │   ├── services/
│   │   │   │   ├── dive.service.ts
│   │   │   │   └── dive.service.spec.ts
│   │   │   ├── app.component.ts
│   │   │   ├── app.component.html
│   │   │   ├── app.component.css
│   │   │   ├── app.module.ts
│   │   │   ├── app-routing.module.ts
│   │   │   └── app-routing.module.spec.ts
│   │   ├── environments/
│   │   │   ├── environment.ts
│   │   │   └── environment.development.ts
│   │   ├── angular.json
│   │   ├── package.json
│   │   └── README.md
```

### 5.2 `frontend/src/app/app-routing.module.ts`
```typescript
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { UploadComponent } from './components/upload/upload.component';
import { VerificationComponent } from './components/verification/verification.component';
import { ListComponent } from './components/list/list.component';

const routes: Routes = [
  { path: 'upload', component: UploadComponent },
  { path: 'verification', component: VerificationComponent },
  { path: 'list', component: ListComponent },
  { path: '', redirectTo: '/list', pathMatch: 'full' },
  { path: '**', redirectTo: '/list' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
```

### 5.3 `frontend/src/app/services/dive.service.ts`
```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface DiveDraft {
  tauchgang_nr?: number | null;
  ort: string;
  datum: string;
  sicht?: string | null;
  gewicht_kg?: number | null;
  dauer_min?: number | null;
  tiefe_m?: number | null;
  temperatur_c?: number | null;
  stroemung?: string | null;
  unterschrift_partner?: string | null;
  stempel?: string[] | null;
}

export interface Dive extends DiveDraft {
  id: number;
  created_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class DiveService {
  private apiUrl = environment.apiUrl || '/api';
  private extractedDive: DiveDraft | null = null;

  constructor(private http: HttpClient) {}

  // Local state for OCR extraction transfer
  setExtractedDive(dive: DiveDraft): void {
    this.extractedDive = dive;
  }

  getExtractedDive(): DiveDraft | null {
    return this.extractedDive;
  }

  clearExtractedDive(): void {
    this.extractedDive = null;
  }

  // HTTP API Services
  getDives(): Observable<Dive[]> {
    return this.http.get<Dive[]>(`${this.apiUrl}/dives`);
  }

  saveDive(dive: DiveDraft): Observable<Dive> {
    const sanitized = this.sanitizeDiveDraft(dive);
    return this.http.post<Dive>(`${this.apiUrl}/dives`, sanitized);
  }

  uploadImage(file: File): Observable<DiveDraft> {
    const formData = new FormData();
    formData.append('image', file, file.name);
    return this.http.post<DiveDraft>(`${this.apiUrl}/upload`, formData);
  }

  /**
   * Coerces values to prevent backend schema validation errors:
   * - Empty strings are converted to null for optional attributes
   * - Numbers are checked, floats rounded for integer inputs, and non-numbers coerced to null
   * - Empty elements are removed from stempel
   */
  private sanitizeDiveDraft(dive: DiveDraft): DiveDraft {
    const coerceNumber = (val: any): number | null => {
      if (val === undefined || val === null || val === '') {
        return null;
      }
      const num = Number(val);
      return Number.isFinite(num) ? num : null;
    };

    const coerceInteger = (val: any): number | null => {
      const num = coerceNumber(val);
      return num !== null ? Math.round(num) : null;
    };

    const coerceString = (val: any): string | null => {
      if (val === undefined || val === null || val === '') {
        return null;
      }
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
      stempel: Array.isArray(dive.stempel)
        ? dive.stempel.filter(s => typeof s === 'string' && s.trim() !== '')
        : null
    };
  }
}
```

### 5.4 `frontend/src/app/services/dive.service.spec.ts`
```typescript
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { DiveService, DiveDraft, Dive } from './dive.service';
import { environment } from '../../environments/environment';

describe('DiveService', () => {
  let service: DiveService;
  let httpMock: HttpTestingController;
  const apiUrl = environment.apiUrl || '/api';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [DiveService]
    });
    service = TestBed.inject(DiveService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Extracted state sharing', () => {
    it('should set, retrieve, and clear extracted dive', () => {
      const mockDraft: DiveDraft = {
        ort: 'Dahab Blue Hole',
        datum: '2026-06-20'
      };
      expect(service.getExtractedDive()).toBeNull();
      service.setExtractedDive(mockDraft);
      expect(service.getExtractedDive()).toEqual(mockDraft);
      service.clearExtractedDive();
      expect(service.getExtractedDive()).toBeNull();
    });
  });

  describe('HTTP endpoints integration', () => {
    it('should query all dives (GET /api/dives)', () => {
      const mockDives: Dive[] = [
        {
          id: 1,
          tauchgang_nr: 527,
          ort: 'Dahab Blue Hole',
          datum: '2026-06-20',
          created_at: '2026-06-21T20:42:00Z'
        }
      ];

      service.getDives().subscribe((dives) => {
        expect(dives).toEqual(mockDives);
      });

      const req = httpMock.expectOne(`${apiUrl}/dives`);
      expect(req.request.method).toBe('GET');
      req.flush(mockDives);
    });

    it('should send a dive log photo (POST /api/upload)', () => {
      const mockFile = new File(['image-bytes'], 'dive-log.png', { type: 'image/png' });
      const mockExtracted: DiveDraft = {
        ort: 'Dahab Blue Hole',
        datum: '2026-06-20',
        tauchgang_nr: 527
      };

      service.uploadImage(mockFile).subscribe((extracted) => {
        expect(extracted).toEqual(mockExtracted);
      });

      const req = httpMock.expectOne(`${apiUrl}/upload`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body instanceof FormData).toBeTrue();
      expect(req.request.body.has('image')).toBeTrue();
      req.flush(mockExtracted);
    });

    it('should save a dive and sanitize payload elements (POST /api/dives)', () => {
      const dirtyDraft: DiveDraft = {
        ort: '  Dahab Blue Hole  ',
        datum: '2026-06-20',
        tauchgang_nr: 527.6, // should round to 528
        sicht: '', // should become null
        gewicht_kg: undefined, // should become null
        dauer_min: 45,
        tiefe_m: 28.5,
        stempel: ['Club Dahab', ''] // empty element should be pruned
      };

      const expectedSaved: Dive = {
        id: 2,
        tauchgang_nr: 528,
        ort: 'Dahab Blue Hole',
        datum: '2026-06-20',
        sicht: null,
        gewicht_kg: null,
        dauer_min: 45,
        tiefe_m: 28.5,
        temperatur_c: null,
        stroemung: null,
        unterschrift_partner: null,
        stempel: ['Club Dahab'],
        created_at: '2026-06-21T21:00:00Z'
      };

      service.saveDive(dirtyDraft).subscribe((saved) => {
        expect(saved).toEqual(expectedSaved);
      });

      const req = httpMock.expectOne(`${apiUrl}/dives`);
      expect(req.request.method).toBe('POST');
      
      // Verify client-side mapping before server call
      expect(req.request.body.ort).toBe('Dahab Blue Hole');
      expect(req.request.body.tauchgang_nr).toBe(528);
      expect(req.request.body.sicht).toBeNull();
      expect(req.request.body.stempel).toEqual(['Club Dahab']);
      
      req.flush(expectedSaved);
    });
  });
});
```

### 5.5 `frontend/src/app/app-routing.module.spec.ts`
```typescript
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { RouterTestingModule } from '@angular/router/testing';
import { Component } from '@angular/core';
import { AppRoutingModule } from './app-routing.module';

@Component({ template: '' })
class MockUploadComponent {}

@Component({ template: '' })
class MockVerificationComponent {}

@Component({ template: '' })
class MockListComponent {}

describe('App Routing Module', () => {
  let router: Router;
  let location: Location;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        RouterTestingModule.withRoutes([
          { path: 'upload', component: MockUploadComponent },
          { path: 'verification', component: MockVerificationComponent },
          { path: 'list', component: MockListComponent },
          { path: '', redirectTo: '/list', pathMatch: 'full' },
          { path: '**', redirectTo: '/list' }
        ])
      ],
      declarations: [
        MockUploadComponent,
        MockVerificationComponent,
        MockListComponent
      ]
    });

    router = TestBed.inject(Router);
    location = TestBed.inject(Location);
    router.initialNavigation();
  });

  it('should redirect empty path to /list', fakeAsync(() => {
    router.navigate(['']);
    tick();
    expect(location.path()).toBe('/list');
  }));

  it('should navigate to /upload', fakeAsync(() => {
    router.navigate(['/upload']);
    tick();
    expect(location.path()).toBe('/upload');
  }));

  it('should navigate to /verification', fakeAsync(() => {
    router.navigate(['/verification']);
    tick();
    expect(location.path()).toBe('/verification');
  }));

  it('should navigate to /list', fakeAsync(() => {
    router.navigate(['/list']);
    tick();
    expect(location.path()).toBe('/list');
  }));

  it('should redirect unknown wildcard path to /list', fakeAsync(() => {
    router.navigate(['/unknown-path-redirect']);
    tick();
    expect(location.path()).toBe('/list');
  }));
});
```

### 5.6 `frontend/src/app/app.module.ts`
```typescript
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { UploadComponent } from './components/upload/upload.component';
import { VerificationComponent } from './components/verification/verification.component';
import { ListComponent } from './components/list/list.component';

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
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
```

---

## 6. Verification Method
1. **Scaffold check**: Run `npx @angular/cli@17 new frontend --routing --style=css --standalone=false --ssr=false`. Verify the existence of `frontend/src/app/app.module.ts` and `frontend/src/app/app-routing.module.ts`.
2. **Compilation**: Run `npm run build` or `npx ng build` inside `frontend/`. Confirm that build finishes successfully without syntax or TypeScript errors.
3. **Unit Tests Run**:
   - Execute `npm run test` or `npx ng test --watch=false` in the `frontend` folder.
   - Assert that all 7 unit test assertions in `dive.service.spec.ts` and `app-routing.module.spec.ts` execute and pass cleanly.
4. **Invalidation condition**: The implementation strategy is considered invalidated if:
   - Floating numbers sent for `dauer_min`, `tauchgang_nr`, or `temperatur_c` bypass rounding and cause the backend to return `400 Bad Request`.
   - Empty string values are transmitted as-is for numeric fields, failing backend validation.
   - File uploads under keys other than `image` fail to match the multer file upload hook.

---

## 7. Action Plan for Implementation
1. **Initialize Angular App**: Run `npx @angular/cli@17 new frontend --routing --style=css --standalone=false --ssr=false` inside the root workspace directory.
2. **Generate components & service**:
   ```bash
   cd frontend
   npx ng generate component components/upload
   npx ng generate component components/verification
   npx ng generate component components/list
   npx ng generate service services/dive
   npx ng generate environments
   ```
3. **Configure Environment endpoints**:
   - In `frontend/src/environments/environment.development.ts`, set `apiUrl: 'http://localhost:3000/api'`.
   - In `frontend/src/environments/environment.ts`, set `apiUrl: '/api'`.
4. **Proxy configuration (Optional but recommended)**:
   - Create `frontend/proxy.conf.json`:
     ```json
     {
       "/api": {
         "target": "http://localhost:3000",
         "secure": false
       }
     }
     ```
   - Update `angular.json` under `projects.frontend.architect.serve.options` to include `"proxyConfig": "proxy.conf.json"`.
5. **Apply code files**: Replace the routing module, service module, routing tests, and service tests with the code templates provided in Section 5.
6. **Register HTTP & Form imports**: Import `HttpClientModule`, `FormsModule`, and `ReactiveFormsModule` in `app.module.ts`.
7. **Test run**: Execute `npm install` and then run `npm run test -- --watch=false` to verify the components and service assertions.
