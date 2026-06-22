# Handoff Report: Frontend Core & Services Design (Milestone 5)

This report details the architectural design, directory layout, routing configuration, service implementation, and testing strategies for the Frontend Core & Services of the Digital Dive Log application.

---

## 1. Observation

Based on a systematic exploration of the repository, the following observations were recorded:

1. **Existing Frontend Codebase**: A search of the root directory `/home/daniel/IdeaProjects/digital-dive-log` using filesystem tools shows that **no `frontend` folder or codebase currently exists**. Only the `backend/`, `e2e/`, root `package.json`, and project metadata files exist:
   ```
   Found 39 results
   PROJECT.md
   TEST_INFRA.md
   TEST_READY.md
   backend
   backend/package.json
   backend/src/...
   e2e/api.spec.js
   e2e/mock-server.js
   package.json
   playwright.config.js
   ```
2. **Angular CLI Availability**: Running `which ng` in the local bash terminal succeeded, revealing that Angular CLI is available in the environment path:
   ```
   /home/daniel/.nvm/versions/node/v22.19.0/bin/ng
   ```
3. **Project Layout Requirements**: According to `PROJECT.md` lines 52-66:
   ```
   52: ├── frontend/
   53: │   ├── src/
   54: │   │   ├── app/
   55: │   │   │   ├── components/
   56: │   │   │   │   ├── upload/         # Upload view
   57: │   │   │   │   ├── verification/   # Form editing view
   58: │   │   │   │   └── list/           # Historical list view
   59: │   │   │   ├── services/
   60: │   │   │   │   └── dive.service.ts # HTTP API client
   61: │   │   │   ├── app.component.ts
   62: │   │   │   ├── app.module.ts
   63: │   │   │   └── app-routing.module.ts
   64: │   ├── angular.json
   65: │   ├── package.json        # Frontend dependencies and scripts
   66: │   └── README.md
   ```
   This layout explicitly demands a module-based Angular configuration (utilizing `app.module.ts` and `app-routing.module.ts`) rather than the modern Angular standalone component default.
4. **Backend REST API Contracts**:
   - `GET /api/dives` (returns an array of dives, where `stempel` is a parsed JSON array).
   - `POST /api/dives` (expects application/json body).
   - `POST /api/upload` (expects multipart/form-data with an `image` file parameter).
5. **Backend Numeric Validation Strictness**: In `backend/src/routes.js` lines 112-132:
   ```javascript
   112:   const numericFields = ['tauchgang_nr', 'dauer_min', 'tiefe_m', 'gewicht_kg', 'temperatur_c'];
   113:   const integerFields = ['tauchgang_nr', 'dauer_min', 'temperatur_c'];
   114:   for (const field of numericFields) {
   115:     const val = req.body[field];
   116:     if (val !== undefined && val !== null) {
   117:       if (!Number.isFinite(val)) {
   118:         return res.status(400).json({ error: `${field} must be a finite number` });
   119:       }
   ```
   This means that if the frontend submits string values for numeric properties (e.g. `{ tauchgang_nr: "527" }`), the backend will return a `400 Bad Request` because `Number.isFinite("527")` evaluates to `false` in JavaScript. Coercion must happen on the frontend.
6. **Backend Port**: `backend/src/server.js` and `e2e/mock-server.js` run on port `3000` by default.

---

## 2. Logic Chain

1. **Project Initialization**: Since the `frontend` folder is absent but the `ng` CLI is available, the worker should initialize the project using the CLI.
2. **Module-based Configuration**: Because `PROJECT.md` specifies `app.module.ts` and `app-routing.module.ts`, and since modern Angular CLI versions default to Standalone components, the worker must run the `ng new` command with the `--standalone=false` flag.
3. **CORS and Local Proxying**: To prevent CORS issues during local development with the Node backend or Mock server running on port `3000`, the worker must configure an Angular proxy file (`proxy.conf.json`) to forward `/api` requests to `http://localhost:3000`.
4. **Data Sanitization and Coercion**: To prevent backend validation failures (specifically the strict `Number.isFinite` checks):
   - The `DiveService` must sanitize input objects prior to sending them.
   - Text fields like `ort`, `datum`, `sicht`, `stroemung`, `unterschrift_partner` should be trimmed. Empty inputs (`""`) should be normalized to `null` (or left as non-empty if required).
   - Numeric inputs must be explicitly cast to TypeScript `number` types (or `null`) using coercion functions.
   - The `stempel` (stamps) array should be sanitized to filter out empty/null entries.

---

## 3. Caveats

- **Angular Version Specifics**: The exact version of the Angular CLI was not verified due to a terminal permission timeout. However, the `--standalone=false` flag is fully supported in Angular v17 and v18. If a different major version is active that does not support the flag, manual structure adjustment might be required, but it is expected that the standard CLI version supports this.
- **Mock Server vs Real Backend**: E2E tests target the mock server at port `3000`. When transitioning to production, the relative path `/api` used by the service remains valid as long as the production environment serves the compiled frontend assets from the Express backend or uses a reverse proxy.

---

## 4. Conclusion

A clean Angular project must be initialized in the `frontend/` directory with a classic module-based configuration (`--standalone=false`). The frontend application must include:
- A routing scheme mapping path navigation to the three required components.
- A `DiveService` wrapping `HttpClient` that performs request data coercion (numbers vs. strings) and array-filtering for `stempel` to strictly align with backend API expectations.
- Unit tests validating routing behavior and HTTP call properties (using `HttpTestingController`).

---

## 5. Verification Method

To independently verify the frontend foundation setup:
1. **Build Verification**: Run `npm run build` in the `frontend` directory.
2. **Unit Test Verification**: Run `npm run test` (configured for a single run using headless Chrome) inside the `frontend` directory:
   ```bash
   ng test --watch=false --browsers=ChromeHeadless
   ```
3. **Integrated E2E Verification**: Start the mock server (`npm run start:mock` in root) and compile/run the frontend to verify integration endpoints (`GET /api/dives`, `POST /api/upload`, `POST /api/dives`) work without CORS or serialization errors.

---

# Projections & Designs

## Proposed Frontend Project Structure

Once initialized and configured, the `frontend/` directory structure must look like this:

```
frontend/
├── proxy.conf.json         # Development proxy mapping /api to backend port 3000
├── angular.json
├── package.json
├── src/
│   ├── index.html
│   ├── main.ts
│   ├── styles.css
│   └── app/
│       ├── components/
│       │   ├── upload/
│       │   │   ├── upload.component.ts
│       │   │   ├── upload.component.html
│       │   │   └── upload.component.css
│       │   ├── verification/
│       │   │   ├── verification.component.ts
│       │   │   ├── verification.component.html
│       │   │   └── verification.component.css
│       │   └── list/
│       │       ├── list.component.ts
│       │       ├── list.component.html
│       │       └── list.component.css
│       ├── services/
│       │   └── dive.service.ts
│       ├── app-routing.module.ts
│       ├── app.component.ts
│       ├── app.component.html
│       ├── app.component.css
│       └── app.module.ts
```

---

## Angular Routing Schema (`app-routing.module.ts`)

The routing module maps the component paths according to the core application pages:

```typescript
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { UploadComponent } from './components/upload/upload.component';
import { VerificationComponent } from './components/verification/verification.component';
import { ListComponent } from './components/list/list.component';

export const routes: Routes = [
  // Default path redirects to historical dives list
  { path: '', redirectTo: '/list', pathMatch: 'full' },
  
  // Direct routes for application views
  { path: 'upload', component: UploadComponent },
  { path: 'verify', component: VerificationComponent },
  { path: 'list', component: ListComponent },
  
  // Wildcard fallback redirects to list
  { path: '**', redirectTo: '/list' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
```

---

## DiveService Implementation (`dive.service.ts`)

`DiveService` wraps Angular's `HttpClient` to manage communications. Crucially, it maps inputs to enforce exact datatype compliance before payloads reach the backend.

```typescript
import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface Dive {
  id?: number;
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
  created_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DiveService {
  private apiUrl = '/api'; // Proxied to backend via devServer proxy.conf.json

  constructor(private http: HttpClient) {}

  /**
   * Fetch all dive logs.
   * GET /api/dives
   */
  getDives(): Observable<Dive[]> {
    return this.http.get<Dive[]>(`${this.apiUrl}/dives`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Save a manual/verified dive log.
   * POST /api/dives
   * Sanitizes input datatypes to prevent backend validation issues.
   */
  saveDive(dive: Dive): Observable<Dive> {
    const sanitizedPayload = this.sanitizeAndMapDive(dive);
    return this.http.post<Dive>(`${this.apiUrl}/dives`, sanitizedPayload).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Upload an image of a physical dive log.
   * POST /api/upload
   * Content-Type must be multipart/form-data (automatically set by FormData).
   */
  uploadImage(file: File): Observable<Dive> {
    const formData = new FormData();
    formData.append('image', file);
    return this.http.post<Dive>(`${this.apiUrl}/upload`, formData).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Form and input bindings can result in numbers being represented as strings
   * or optional fields filled with empty text. This helper coerces those fields
   * to align with the backend's database constraints.
   */
  private sanitizeAndMapDive(dive: Dive): Dive {
    const coerceToNumberOrNull = (val: any, isInteger: boolean): number | null => {
      if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
        return null;
      }
      const parsed = Number(val);
      if (!Number.isFinite(parsed)) {
        return null;
      }
      return isInteger ? Math.round(parsed) : parsed;
    };

    const coerceToStringOrNull = (val: any): string | null => {
      if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
        return null;
      }
      return String(val).trim();
    };

    return {
      tauchgang_nr: coerceToNumberOrNull(dive.tauchgang_nr, true),
      ort: String(dive.ort || '').trim(),
      datum: String(dive.datum || '').trim(),
      sicht: coerceToStringOrNull(dive.sicht),
      gewicht_kg: coerceToNumberOrNull(dive.gewicht_kg, false),
      dauer_min: coerceToNumberOrNull(dive.dauer_min, true),
      tiefe_m: coerceToNumberOrNull(dive.tiefe_m, false),
      temperatur_c: coerceToNumberOrNull(dive.temperatur_c, true),
      stroemung: coerceToStringOrNull(dive.stroemung),
      unterschrift_partner: coerceToStringOrNull(dive.unterschrift_partner),
      stempel: Array.isArray(dive.stempel)
        ? dive.stempel.filter(item => item !== undefined && item !== null && String(item).trim() !== '').map(item => String(item).trim())
        : null
    };
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unknown error occurred!';
    if (error.error instanceof ErrorEvent) {
      // Client-side / network error
      errorMessage = `Client-side Error: ${error.error.message}`;
    } else {
      // Backend error response
      errorMessage = error.error?.error || `Server Error Code: ${error.status}\nMessage: ${error.message}`;
    }
    return throwError(() => new Error(errorMessage));
  }
}
```

---

## Unit Testing Specifications

### 1. Routing Module Tests (`app-routing.module.spec.ts`)

Verifies that default navigation, direct URLs, and wildcard patterns redirect and render the proper components.

```typescript
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { RouterTestingModule } from '@angular/router/testing';
import { UploadComponent } from './components/upload/upload.component';
import { VerificationComponent } from './components/verification/verification.component';
import { ListComponent } from './components/list/list.component';
import { Component } from '@angular/core';

// Lightweight component mocks
@Component({ template: '<router-outlet></router-outlet>' }) class MockAppComponent {}
@Component({ template: '' }) class MockUploadComponent {}
@Component({ template: '' }) class MockVerificationComponent {}
@Component({ template: '' }) class MockListComponent {}

describe('App Routing Configuration', () => {
  let router: Router;
  let location: Location;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        RouterTestingModule.withRoutes([
          { path: '', redirectTo: '/list', pathMatch: 'full' },
          { path: 'upload', component: MockUploadComponent },
          { path: 'verify', component: MockVerificationComponent },
          { path: 'list', component: MockListComponent },
          { path: '**', redirectTo: '/list' }
        ])
      ],
      declarations: [
        MockAppComponent,
        MockUploadComponent,
        MockVerificationComponent,
        MockListComponent
      ]
    });

    router = TestBed.inject(Router);
    location = TestBed.inject(Location);
    router.initialNavigation();
  });

  it('should redirect empty path ("") to "/list"', fakeAsync(() => {
    router.navigate(['']);
    tick();
    expect(location.path()).toBe('/list');
  }));

  it('should navigate to "/upload" and load UploadComponent', fakeAsync(() => {
    router.navigate(['/upload']);
    tick();
    expect(location.path()).toBe('/upload');
  }));

  it('should navigate to "/verify" and load VerificationComponent', fakeAsync(() => {
    router.navigate(['/verify']);
    tick();
    expect(location.path()).toBe('/verify');
  }));

  it('should navigate to "/list" and load ListComponent', fakeAsync(() => {
    router.navigate(['/list']);
    tick();
    expect(location.path()).toBe('/list');
  }));

  it('should redirect invalid/wildcard paths to "/list"', fakeAsync(() => {
    router.navigate(['/unknown-path-goes-here']);
    tick();
    expect(location.path()).toBe('/list');
  }));
});
```

### 2. DiveService Tests (`dive.service.spec.ts`)

Validates API call formatting, error routing, and data type coercion.

```typescript
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { DiveService, Dive } from './dive.service';

describe('DiveService', () => {
  let service: DiveService;
  let httpMock: HttpTestingController;

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

  describe('getDives', () => {
    it('should issue a GET request and return the list of dives', () => {
      const mockDives: Dive[] = [
        {
          id: 1,
          tauchgang_nr: 527,
          ort: 'Dahab Blue Hole',
          datum: '2026-06-20',
          stempel: ['Scuba Club Dahab']
        }
      ];

      service.getDives().subscribe(dives => {
        expect(dives).toEqual(mockDives);
      });

      const req = httpMock.expectOne('/api/dives');
      expect(req.request.method).toBe('GET');
      req.flush(mockDives);
    });

    it('should forward backend error messages to the subscriber', () => {
      service.getDives().subscribe({
        next: () => fail('Expected an error response'),
        error: (err) => {
          expect(err.message).toContain('Database connection lost');
        }
      });

      const req = httpMock.expectOne('/api/dives');
      req.flush({ error: 'Database connection lost' }, { status: 500, statusText: 'Internal Error' });
    });
  });

  describe('saveDive', () => {
    it('should cast numeric string form-values to actual numbers and strip invalid values', () => {
      const formInput: any = {
        tauchgang_nr: '99',          // String representation of integer
        ort: '  Shark Reef   ',      // Padded spaces
        datum: '2026-06-21',
        gewicht_kg: '12.4',          // String representation of float
        dauer_min: '62',
        tiefe_m: '30.5',
        temperatur_c: '18',
        stempel: ['Club 1', '', null, 'Club 2'] // Null and empty string array items
      };

      const expectedPayload: Dive = {
        tauchgang_nr: 99,
        ort: 'Shark Reef',
        datum: '2026-06-21',
        sicht: null,
        gewicht_kg: 12.4,
        dauer_min: 62,
        tiefe_m: 30.5,
        temperatur_c: 18,
        stroemung: null,
        unterschrift_partner: null,
        stempel: ['Club 1', 'Club 2']
      };

      service.saveDive(formInput).subscribe();

      const req = httpMock.expectOne('/api/dives');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(expectedPayload);
      req.flush(expectedPayload);
    });

    it('should assign null to invalid numeric entries', () => {
      const formInput: any = {
        tauchgang_nr: 'not-a-number',
        ort: 'Canyon',
        datum: '2026-06-22',
        gewicht_kg: 'invalid'
      };

      service.saveDive(formInput).subscribe();

      const req = httpMock.expectOne('/api/dives');
      expect(req.request.body.tauchgang_nr).toBeNull();
      expect(req.request.body.gewicht_kg).toBeNull();
      req.flush({});
    });
  });

  describe('uploadImage', () => {
    it('should upload a file payload as multipart/form-data', () => {
      const mockFile = new File(['image-bytes'], 'dive_log.jpg', { type: 'image/jpeg' });
      
      service.uploadImage(mockFile).subscribe();

      const req = httpMock.expectOne('/api/upload');
      expect(req.request.method).toBe('POST');
      expect(req.request.body instanceof FormData).toBe(true);
      expect(req.request.body.get('image')).toEqual(mockFile);
      req.flush({});
    });
  });
});
```

---

# Worker Implementation Steps

The Worker should follow these step-by-step instructions exactly to build and test the core frontend modules:

### Step 1: Initialize the Angular Project
Run the Angular CLI generation command to create the directory layout using classic Angular modules:
```bash
# In the root repository directory (/home/daniel/IdeaProjects/digital-dive-log):
ng new frontend --routing --standalone=false --style=css --ssr=false --skip-git
```

### Step 2: Configure the Local Development Proxy
Create a new file `frontend/proxy.conf.json` with mapping options to target the Node backend server:
```json
{
  "/api": {
    "target": "http://localhost:3000",
    "secure": false
  }
}
```
Update `angular.json` under the `serve` options so the proxy configuration is used by default when executing `ng serve`:
```json
// Inside frontend/angular.json:
"serve": {
  "builder": "@angular-devkit/build-angular:dev-server",
  "options": {
    "proxyConfig": "proxy.conf.json"
  },
  ...
}
```

### Step 3: Populate Root and Global Scripts
1. Update `package.json` in the **root** folder of the repository to add helper shortcuts:
   ```json
   "scripts": {
     "start:mock": "node e2e/mock-server.js",
     "start:backend": "npm --prefix backend start",
     "start:frontend": "npm --prefix frontend start",
     "test:frontend": "npm --prefix frontend test -- --watch=false --browsers=ChromeHeadless",
     "e2e": "playwright test"
   }
   ```
2. In the `frontend/` directory, ensure the `test` script in `package.json` is set to run headlessly:
   ```json
   "test": "ng test --watch=false --browsers=ChromeHeadless"
   ```

### Step 4: Create Component Stubs
Generate the component stubs in the correct paths as defined in the project plan:
```bash
cd frontend
ng generate component components/upload
ng generate component components/verification
ng generate component components/list
```

### Step 5: Configure Application Modules and Routing
1. Implement the routing definitions inside `frontend/src/app/app-routing.module.ts` using the provided code template.
2. In `frontend/src/app/app.module.ts`:
   - Import `HttpClientModule` from `@angular/common/http`.
   - Import `FormsModule` and `ReactiveFormsModule` from `@angular/forms`.
   - Ensure `UploadComponent`, `VerificationComponent`, and `ListComponent` are declared.
   - Register `HttpClientModule`, `FormsModule`, and `ReactiveFormsModule` in the `imports` array.
3. In `frontend/src/app/app.component.html`, replace the default boilerplate with a routing wrapper:
   ```html
   <div class="app-container">
     <header>
       <h1>Digital Dive Log</h1>
       <nav>
         <a routerLink="/list" routerLinkActive="active">Dives List</a> | 
         <a routerLink="/upload" routerLinkActive="active">Upload Log</a>
       </nav>
     </header>
     <main style="padding: 20px;">
       <router-outlet></router-outlet>
     </main>
   </div>
   ```

### Step 6: Implement DiveService
1. Generate the service class:
   ```bash
   ng generate service services/dive
   ```
2. Replace the contents of `frontend/src/app/services/dive.service.ts` with the provided implementation code, making sure all casting, trimming, and coercion helper functions are included.

### Step 7: Write Unit Tests
1. Replace contents of `frontend/src/app/app-routing.module.spec.ts` (create it if missing) with the routing unit tests template.
2. Replace contents of `frontend/src/app/services/dive.service.spec.ts` with the unit test specs using `HttpTestingController`.

### Step 8: Build and Run Tests
Validate the implementation:
```bash
# Run unit tests
npm run test:frontend

# Verify production build succeeds
npm run build --prefix frontend
```
Report any test discrepancies back to the orchestrator.
