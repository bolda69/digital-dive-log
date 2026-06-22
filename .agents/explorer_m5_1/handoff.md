# Milestone 5 Handoff Report: Frontend Core & Services

This report contains findings and design recommendations for Milestone 5 (Frontend Core & Services) of the Digital Dive Log project.

---

## 1. Observation
We observed the following state and configuration in the repository:
1. **Existing Frontend Check**:
   - The directory listing of the root project `/home/daniel/IdeaProjects/digital-dive-log` contains:
     - `PROJECT.md`
     - `TEST_INFRA.md`
     - `TEST_READY.md`
     - `backend/`
     - `e2e/`
     - `package.json`
     - `package-lock.json`
   - There is no `frontend/` directory currently present in the codebase.
2. **Environment Tooling**:
   - The command `which ng` returned `/home/daniel/.nvm/versions/node/v22.19.0/bin/ng`, proving that a global Angular CLI (`ng`) is available inside the active Node.js (`v22.19.0`) environment.
3. **Backend Routes and DB Contracts**:
   - `backend/src/app.js` mounts the database API routes on `/api` (line 20: `app.use('/api', routes);`).
   - `backend/src/routes.js` defines three core endpoints:
     - `GET /api/dives` - Returns a JSON array of dive objects.
     - `POST /api/dives` - Accepts a JSON object representing a dive, validates it, and returns `201 Created` with database fields (`id`, `created_at`).
     - `POST /api/upload` - Accepts `multipart/form-data` with a single file parameter named `image`, and returns a JSON payload containing the extracted fields.
   - DB layout in `backend/src/db.js` (lines 57-72) contains fields:
     - `id` (INTEGER PRIMARY KEY)
     - `tauchgang_nr` (INTEGER)
     - `ort` (TEXT - required)
     - `datum` (TEXT - required, format YYYY-MM-DD)
     - `sicht` (TEXT)
     - `gewicht_kg` (REAL)
     - `dauer_min` (INTEGER)
     - `tiefe_m` (REAL)
     - `temperatur_c` (INTEGER)
     - `stroemung` (TEXT)
     - `unterschrift_partner` (TEXT)
     - `stempel` (TEXT CHECK (stempel IS NULL OR (json_valid(stempel) AND json_type(stempel) = 'array')))
     - `created_at` (TEXT)
   - When retrieving rows, the backend parses `stempel` (if set) back into a JS array:
     ```javascript
     if (row && row.stempel) {
       try {
         row.stempel = JSON.parse(row.stempel);
       } catch (e) {}
     }
     ```
   - In `routes.js` line 208-220: when mock extraction happens with `null_optional` query, the API returns:
     ```json
     {
       "tauchgang_nr": null,
       "ort": "Dahab Blue Hole",
       "datum": "2026-06-20",
       "sicht": null,
       "gewicht_kg": null,
       "dauer_min": null,
       "tiefe_m": null,
       "temperatur_c": null,
       "stroemung": null,
       "unterschrift_partner": null,
       "stempel": []
     }
     ```

---

## 2. Logic Chain
- **Frontend Initialization**: Since no `frontend/` directory exists and a global Angular CLI is in the shell path, we can directly run the Angular CLI command `ng new frontend` to initialize the project structure.
- **Standalone Settings**: Modern Angular CLI (v17+) defaults to standalone components. However, `PROJECT.md` specifies an `app.module.ts` and `app-routing.module.ts` layout. To align with this, the `ng new` command must be invoked with `--standalone=false` to generate the classic module-based architecture. Disabling Server-Side Rendering (`--ssr=false`) simplifies the initial setup as we only need a standard Single Page Application (SPA).
- **Routing Configuration**: To navigate between the upload screen, the manual verification form, and the historical list, we need corresponding components. Separating the static routes array into an exported constant `routes` in `app-routing.module.ts` will make unit testing the routes isolated and robust.
- **Contract Handling & Property Mapping**:
  - **Stamps (`stempel`)**: The API outputs `stempel` as a JSON array of strings (or `null`/`[]` when empty). To prevent client-side template errors (like trying to loop or join null objects), the service must map `null` values of `stempel` to a fallback empty array `[]`.
  - **Optional Fields**: In Angular templates, empty inputs usually bind to empty strings (`""`). The backend expects `null` or valid string structures. To keep the database clean and prevent invalid empty strings (which could bypass the backend's validation checks), we must trim and map empty strings to `null` before POSTing to `/api/dives`.
  - **Data Coercion**: To enforce strict type safety, optional numbers (such as `gewicht_kg`, `tiefe_m`) must be parsed to float/integer or `null` before submission, preventing stringified numbers from hitting the API.
- **State Management**: The flow requires data passing from `/upload` (AI extraction result) to `/verify` (edit form). Storing the transient draft object in a shared `BehaviorSubject` in the `DiveService` is the cleanest and most testable way to manage this state.

---

## 3. Caveats
- **Routing Guards**: We assume that if a user navigates to `/verify` directly (without an active draft in the service), the page will display an empty state or redirect back to `/upload`. This is a UI decision left to the Implementer of Milestone 6.
- **Angular CLI versioning**: If the system's global `ng` CLI is an older version that does not support `--ssr=false` or `--standalone=false`, the default initialization command may fail or ignore those flags. In that case, the default `ng new` should be used and then adjusted. However, Node v22.19.0 suggests a modern environment where these flags are fully supported.
- **No Direct Mock API in Frontend**: We assume the frontend will communicate with `/api` endpoints, and a development proxy (configured in `proxy.conf.json`) or local environment configs will map these to `http://localhost:3000`.

---

## 4. Conclusion
We conclude that the Angular project must be initialized in `/frontend` using Node v22.19.0 and `ng` with standalone mode turned off. The application structure, routing scheme, and HTTP integration service must map perfectly to the backend API contracts. Detailed layouts, files, and step-by-step instructions have been provided to guide the Worker.

---

## 5. Proposed Designs

### A. Directory Layout
The initialized `frontend` application should match the following structure:
```
digital-dive-log/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/
│   │   │   │   ├── upload/
│   │   │   │   │   ├── upload.component.ts
│   │   │   │   │   ├── upload.component.html
│   │   │   │   │   ├── upload.component.css
│   │   │   │   │   └── upload.component.spec.ts
│   │   │   │   ├── verification/
│   │   │   │   │   ├── verification.component.ts
│   │   │   │   │   ├── verification.component.html
│   │   │   │   │   ├── verification.component.css
│   │   │   │   │   └── verification.component.spec.ts
│   │   │   │   └── list/
│   │   │   │       ├── list.component.ts
│   │   │   │       ├── list.component.html
│   │   │   │       ├── list.component.css
│   │   │   │       └── list.component.spec.ts
│   │   │   ├── services/
│   │   │   │   ├── dive.service.ts
│   │   │   │   └── dive.service.spec.ts
│   │   │   ├── app.component.ts
│   │   │   ├── app.component.html
│   │   │   ├── app.component.css
│   │   │   ├── app.module.ts
│   │   │   ├── app-routing.module.ts
│   │   │   └── app-routing.module.spec.ts
│   ├── angular.json
│   ├── package.json
│   ├── tsconfig.json
│   └── proxy.conf.json
```

### B. Routing Scheme (`app-routing.module.ts`)
To configure the application pathways and allow routing unit tests, separate the `routes` constant from the routing module declaration:
```typescript
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { UploadComponent } from './components/upload/upload.component';
import { VerificationComponent } from './components/verification/verification.component';
import { ListComponent } from './components/list/list.component';

export const routes: Routes = [
  { path: '', redirectTo: '/dives', pathMatch: 'full' },
  { path: 'upload', component: UploadComponent },
  { path: 'verify', component: VerificationComponent },
  { path: 'dives', component: ListComponent },
  { path: '**', redirectTo: '/dives' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
```

### C. Dive Interface and Service (`dive.service.ts`)
The `DiveService` handles HTTP communication with backend endpoints (`GET /api/dives`, `POST /api/dives`, `POST /api/upload`) and provides shared state management for OCR drafts.
```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, tap } from 'rxjs/operators';

export interface Dive {
  id?: number;
  tauchgang_nr: number | null;
  ort: string;
  datum: string;
  sicht: string | null;
  gewicht_kg: number | null;
  dauer_min: number | null;
  tiefe_m: number | null;
  temperatur_c: number | null;
  stroemung: string | null;
  unterschrift_partner: string | null;
  stempel: string[];
  created_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DiveService {
  private apiUrl = '/api'; // Maps to backend API via proxy

  // Shared state for the currently uploaded and unverified dive draft
  private draftDiveSubject = new BehaviorSubject<Dive | null>(null);
  public draftDive$ = this.draftDiveSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Fetch all saved dives.
   */
  getDives(): Observable<Dive[]> {
    return this.http.get<Dive[]>(`${this.apiUrl}/dives`).pipe(
      map(dives => dives.map(dive => this.sanitizeDive(dive)))
    );
  }

  /**
   * Save a verified dive to the database. Clears transient draft on success.
   */
  saveDive(dive: Dive): Observable<Dive> {
    const cleanedDive = this.prepareForBackend(dive);
    return this.http.post<Dive>(`${this.apiUrl}/dives`, cleanedDive).pipe(
      map(savedDive => this.sanitizeDive(savedDive)),
      tap(() => this.setDraftDive(null))
    );
  }

  /**
   * Upload physical dive log image for OCR and AI analysis.
   */
  uploadImage(file: File): Observable<Partial<Dive>> {
    const formData = new FormData();
    formData.append('image', file);

    return this.http.post<Partial<Dive>>(`${this.apiUrl}/upload`, formData).pipe(
      map(draft => this.sanitizeDive(draft as Dive)),
      tap(draft => this.setDraftDive(draft))
    );
  }

  /**
   * Update the shared draft state.
   */
  setDraftDive(dive: Dive | null): void {
    this.draftDiveSubject.next(dive);
  }

  /**
   * Get the current draft dive from shared state.
   */
  getDraftDive(): Dive | null {
    return this.draftDiveSubject.value;
  }

  /**
   * Sanitizes a Dive record returned by the backend.
   * Ensures that arrays are populated and numbers/strings are typed correctly.
   */
  private sanitizeDive(dive: Partial<Dive>): Dive {
    return {
      id: dive.id,
      tauchgang_nr: (dive.tauchgang_nr !== undefined && dive.tauchgang_nr !== null) ? Number(dive.tauchgang_nr) : null,
      ort: dive.ort || '',
      datum: dive.datum || '',
      sicht: dive.sicht || null,
      gewicht_kg: (dive.gewicht_kg !== undefined && dive.gewicht_kg !== null) ? Number(dive.gewicht_kg) : null,
      dauer_min: (dive.dauer_min !== undefined && dive.dauer_min !== null) ? Number(dive.dauer_min) : null,
      tiefe_m: (dive.tiefe_m !== undefined && dive.tiefe_m !== null) ? Number(dive.tiefe_m) : null,
      temperatur_c: (dive.temperatur_c !== undefined && dive.temperatur_c !== null) ? Number(dive.temperatur_c) : null,
      stroemung: dive.stroemung || null,
      unterschrift_partner: dive.unterschrift_partner || null,
      stempel: Array.isArray(dive.stempel) ? dive.stempel : [],
      created_at: dive.created_at
    };
  }

  /**
   * Cleans and coerces Dive fields before submission to the API.
   * Empty form fields ("") are normalized to null.
   */
  private prepareForBackend(dive: Dive): Partial<Dive> {
    return {
      tauchgang_nr: dive.tauchgang_nr !== null ? Number(dive.tauchgang_nr) : null,
      ort: dive.ort ? dive.ort.trim() : '',
      datum: dive.datum ? dive.datum.trim() : '',
      sicht: (dive.sicht && dive.sicht.trim()) ? dive.sicht.trim() : null,
      gewicht_kg: dive.gewicht_kg !== null ? Number(dive.gewicht_kg) : null,
      dauer_min: dive.dauer_min !== null ? Number(dive.dauer_min) : null,
      tiefe_m: dive.tiefe_m !== null ? Number(dive.tiefe_m) : null,
      temperatur_c: dive.temperatur_c !== null ? Number(dive.temperatur_c) : null,
      stroemung: (dive.stroemung && dive.stroemung.trim()) ? dive.stroemung.trim() : null,
      unterschrift_partner: (dive.unterschrift_partner && dive.unterschrift_partner.trim()) ? dive.unterschrift_partner.trim() : null,
      stempel: Array.isArray(dive.stempel) ? dive.stempel : []
    };
  }
}
```

### D. Proposed Unit Test Cases

#### i. Routing Tests (`app-routing.module.spec.ts`)
Verifies that routing configuration registers all expected component paths and redirects properly.
```typescript
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { Location } from '@angular/common';
import { Component } from '@angular/core';
import { routes } from './app-routing.module';

@Component({ template: '<router-outlet></router-outlet>' })
export class MockAppComponent {}

@Component({ template: 'Upload' })
export class MockUploadComponent {}

@Component({ template: 'Verify' })
export class MockVerificationComponent {}

@Component({ template: 'List' })
export class MockListComponent {}

describe('AppRoutingModule Routing', () => {
  let router: Router;
  let location: Location;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule.withRoutes(routes)],
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

  it('should redirect empty path "" to "/dives"', fakeAsync(() => {
    router.navigate(['']);
    tick();
    expect(location.path()).toBe('/dives');
  }));

  it('should navigate to "/upload"', fakeAsync(() => {
    router.navigate(['upload']);
    tick();
    expect(location.path()).toBe('/upload');
  }));

  it('should navigate to "/verify"', fakeAsync(() => {
    router.navigate(['verify']);
    tick();
    expect(location.path()).toBe('/verify');
  }));

  it('should navigate to "/dives"', fakeAsync(() => {
    router.navigate(['dives']);
    tick();
    expect(location.path()).toBe('/dives');
  }));

  it('should redirect invalid wildcard path to "/dives"', fakeAsync(() => {
    router.navigate(['non-existent-page']);
    tick();
    expect(location.path()).toBe('/dives');
  }));
});
```

#### ii. Service Tests (`services/dive.service.spec.ts`)
Verifies endpoint targeting, header contents, data normalization (coercing strings/numbers/nulls), and draft state updates.
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

  it('should perform GET request and map null stempel to empty array', () => {
    const mockDives = [
      {
        id: 1,
        tauchgang_nr: 527,
        ort: 'Dahab Blue Hole',
        datum: '2026-06-20',
        sicht: '20m',
        stempel: null // Server returns null
      }
    ];

    service.getDives().subscribe(dives => {
      expect(dives.length).toBe(1);
      expect(dives[0].stempel).toEqual([]); // Mapped to array
    });

    const req = httpMock.expectOne('/api/dives');
    expect(req.request.method).toBe('GET');
    req.flush(mockDives);
  });

  it('should perform POST request and normalize empty spaces to null', () => {
    const inputDive: Dive = {
      tauchgang_nr: 527,
      ort: 'Dahab Blue Hole',
      datum: '2026-06-20',
      sicht: '  ', // Empty input space
      gewicht_kg: null,
      dauer_min: null,
      tiefe_m: null,
      temperatur_c: null,
      stroemung: '', // Empty input string
      unterschrift_partner: null,
      stempel: []
    };

    service.saveDive(inputDive).subscribe();

    const req = httpMock.expectOne('/api/dives');
    expect(req.request.method).toBe('POST');
    // Ensure normalization worked
    expect(req.request.body.sicht).toBeNull();
    expect(req.request.body.stroemung).toBeNull();
    req.flush({ id: 1, ...inputDive, sicht: null, stroemung: null });
  });

  it('should clear draftDive on successful save', () => {
    const mockDraft: Dive = {
      tauchgang_nr: 527,
      ort: 'Dahab',
      datum: '2026-06-20',
      sicht: null,
      gewicht_kg: null,
      dauer_min: null,
      tiefe_m: null,
      temperatur_c: null,
      stroemung: null,
      unterschrift_partner: null,
      stempel: []
    };

    service.setDraftDive(mockDraft);
    expect(service.getDraftDive()).toEqual(mockDraft);

    service.saveDive(mockDraft).subscribe();

    const req = httpMock.expectOne('/api/dives');
    req.flush({ id: 1, ...mockDraft });

    expect(service.getDraftDive()).toBeNull();
  });

  it('should perform upload POST request with FormData and store draft', () => {
    const mockFile = new File([''], 'log.png', { type: 'image/png' });
    const mockResponse = {
      tauchgang_nr: 10,
      ort: 'Marsa Alam',
      datum: '2026-06-22',
      stempel: null
    };

    service.uploadImage(mockFile).subscribe(draft => {
      expect(draft.ort).toBe('Marsa Alam');
      expect(draft.stempel).toEqual([]);
    });

    const req = httpMock.expectOne('/api/upload');
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    req.flush(mockResponse);

    const activeDraft = service.getDraftDive();
    expect(activeDraft).toBeTruthy();
    expect(activeDraft?.ort).toBe('Marsa Alam');
  });
});
```

---

## 6. Verification Method

To verify the implementation of Milestone 5, the Worker can execute the following:
1. **Routing Verification**:
   - Serve the application locally (`ng serve`) or compile routing module files and check compilation logs.
   - Run Angular routing unit tests to confirm paths `""`, `"upload"`, `"verify"`, and `"dives"` map to the correct components.
2. **Service Verification**:
   - Run the service unit tests inside the `frontend` folder:
     ```bash
     cd frontend
     ng test --watch=false --browsers=ChromeHeadless
     ```
   - All tests in `dive.service.spec.ts` and `app-routing.module.spec.ts` should pass.
3. **Integration Mock Checks**:
   - Start the backend mock server:
     ```bash
     npm run start:mock
     ```
   - Launch the frontend application pointing to the proxy configuration (`proxy.conf.json` mapping `/api` to `http://localhost:3000/api`).
   - Trigger the browser console or use testing scripts to ensure that when a request is made, requests hit `http://localhost:3000` and return valid payload answers.

---

## 7. Step-by-Step Instructions for the Worker

The Worker should perform these steps to complete the implementation of Milestone 5:

1. **Initialize the Angular Project**:
   - In the project root directory (`/home/daniel/IdeaProjects/digital-dive-log`), run:
     ```bash
     ng new frontend --routing=true --style=css --standalone=false --ssr=false --skip-git
     ```
2. **Setup Proxy Config**:
   - Create `frontend/proxy.conf.json` with the following configuration to bridge dev requests to the mock server:
     ```json
     {
       "/api": {
         "target": "http://localhost:3000",
         "secure": false
       }
     }
     ```
   - Update `frontend/angular.json` under `projects -> frontend -> architect -> serve -> options` to include `"proxyConfig": "proxy.conf.json"`.
3. **Generate App Components**:
   - Navigate to `frontend` directory: `cd frontend`
   - Run CLI generators:
     ```bash
     ng g component components/upload --skip-tests=false
     ng g component components/verification --skip-tests=false
     ng g component components/list --skip-tests=false
     ```
4. **Generate Dive Service**:
   - From `frontend` directory, run:
     ```bash
     ng g service services/dive --skip-tests=false
     ```
5. **Configure Routing**:
   - Open `frontend/src/app/app-routing.module.ts` and overwrite the code with the design in **Section 5.B**.
   - Create `frontend/src/app/app-routing.module.spec.ts` and paste the test cases from **Section 5.D.i**.
6. **Configure App Module**:
   - Edit `frontend/src/app/app.module.ts` to register `HttpClientModule` and `ReactiveFormsModule` as follows:
     ```typescript
     import { NgModule } from '@angular/core';
     import { BrowserModule } from '@angular/platform-browser';
     import { HttpClientModule } from '@angular/common/http';
     import { ReactiveFormsModule } from '@angular/forms';

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
         ReactiveFormsModule
       ],
       providers: [],
       bootstrap: [AppComponent]
     })
     export class AppModule { }
     ```
7. **Implement Service**:
   - Copy the implementation of `DiveService` in **Section 5.C** to `frontend/src/app/services/dive.service.ts`.
   - Copy the test file contents in **Section 5.D.ii** to `frontend/src/app/services/dive.service.spec.ts`.
8. **Verify Unit Tests**:
   - Run unit tests to check implementation completeness:
     ```bash
     ng test --watch=false --browsers=ChromeHeadless
     ```
   - Verify all unit tests execute and pass successfully.
9. **Add Monorepo Run Scripts**:
   - In the root `package.json`, append useful control scripts:
     - `"start:frontend": "cd frontend && ng serve"`
     - `"test:frontend": "cd frontend && ng test --watch=false --browsers=ChromeHeadless"`
