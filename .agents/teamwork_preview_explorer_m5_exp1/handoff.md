# Handoff Report: Milestone 5 — Frontend Core & Services

This report contains findings, design specifications, and implementation guidelines for Milestone 5 (Frontend Core & Services) of the Digital Dive Log project.

---

## 1. Observation

1. **Frontend Absence**: 
   - Listing `/home/daniel/IdeaProjects/digital-dive-log` verifies that the `frontend/` directory does not currently exist. Only `backend/`, `e2e/`, `node_modules/`, `package.json`, `package-lock.json`, and project metadata files are present.
2. **Monorepo Layout**: 
   - The root `package.json` does not configure npm workspaces, meaning `frontend/` must be initialized as an independent npm module.
3. **Backend API Route Mounting**: 
   - `backend/src/app.js` mounts the database API routes at prefix `/api` via line 20: `app.use('/api', routes);`.
4. **Backend Contracts & Constraints**:
   - `POST /api/upload`: Expects a multipart form-data request containing a single file under the key `image`. It returns a JSON object representing the extracted fields.
   - `POST /api/dives`: Accepts a JSON object and performs strict type validation. Under `backend/src/routes.js:114-145`:
     - Numeric fields (`tauchgang_nr`, `dauer_min`, `tiefe_m`, `gewicht_kg`, `temperatur_c`) must be finite numbers or `null`/`undefined`. Empty strings (`""`) trigger a `400 Bad Request`.
     - Integer fields (`tauchgang_nr`, `dauer_min`, `temperatur_c`) are validated as integers.
     - `stempel` must be an array of strings (or `null`).
   - `GET /api/dives`: Returns a JSON array of saved dive records.
5. **Project Architecture**: 
   - `PROJECT.md` lines 52-66 requires an NgModule-based Angular layout, specifically referencing `app.module.ts`, `app-routing.module.ts`, and individual component folders under `components/`.

---

## 2. Logic Chain

1. **Frontend Initialization**:
   - Since modern Angular CLI (v17+) defaults to standalone components, initializing the project with `npx @angular/cli@17 new frontend --routing --style=css --standalone=false --ssr=false` is necessary to produce the traditional module-based structure required by `PROJECT.md`.
2. **Routing Setup**:
   - The paths `/upload`, `/verification`, and `/list` align with the component naming in `PROJECT.md`. Adding aliases `/verify` and `/dives` ensures backwards compatibility and flexible page navigation. Wildcard and empty paths should redirect to `/list` or `/dives` as the baseline landing view.
3. **DiveService Design**:
   - **HTTP Integration**: The service maps API calls directly to `/api/upload`, `/api/dives`, and `/api/dives` using Angular's `HttpClient`.
   - **Draft State Coordination**: An uploaded log must pass transient OCR results from `UploadComponent` to `VerificationComponent`. Storing this state in a reactive `BehaviorSubject` inside the service is standard best-practice, allowing components to subscribe to updates.
   - **Data Normalization & Coercion**: Angular forms bind empty inputs to empty strings (`""`). Because the backend rejects empty strings for numeric fields, the service must sanitize data by mapping empty strings to `null` and rounding integers prior to HTTP submission.
4. **Testing Strategy**:
   - Routing tests should confirm that route navigation correctly loads designated components and wildcard routes redirect properly.
   - Service tests should mock HTTP calls with `HttpTestingController` and verify FormData packaging, request headers, payload mapping, and sanitization logic.

---

## 3. Caveats

- **API Access & Proxy**: During local development, calls to `/api` must be forwarded to the mock backend running on port 3000. This is achieved by creating a `proxy.conf.json` in Angular.
- **Node Environment**: The global Node environment is configured at `v22.19.0`, which fully supports `@angular/cli@17`.

---

## 4. Conclusion

The Angular frontend must be initialized under `/frontend` as an NgModule-based SPA. The routing must coordinate views for upload, verification, and listing. The `DiveService` must sanitize input fields to conform to backend database constraints and leverage a `BehaviorSubject` for transient state propagation.

---

## 5. Proposed Implementation Details

### A. Routing Scheme (`frontend/src/app/app-routing.module.ts`)
```typescript
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { UploadComponent } from './components/upload/upload.component';
import { VerificationComponent } from './components/verification/verification.component';
import { ListComponent } from './components/list/list.component';

export const routes: Routes = [
  { path: 'upload', component: UploadComponent },
  { path: 'verification', component: VerificationComponent },
  { path: 'verify', redirectTo: '/verification', pathMatch: 'full' },
  { path: 'list', component: ListComponent },
  { path: 'dives', redirectTo: '/list', pathMatch: 'full' },
  { path: '', redirectTo: '/list', pathMatch: 'full' },
  { path: '**', redirectTo: '/list' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
```

### B. Service Class (`frontend/src/app/services/dive.service.ts`)
```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, tap } from 'rxjs/operators';

export interface DiveDraft {
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
}

export interface Dive extends DiveDraft {
  id: number;
  created_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class DiveService {
  private apiUrl = '/api'; // Proxied to http://localhost:3000

  private draftDiveSubject = new BehaviorSubject<DiveDraft | null>(null);
  public draftDive$ = this.draftDiveSubject.asObservable();

  constructor(private http: HttpClient) {}

  getDives(): Observable<Dive[]> {
    return this.http.get<Dive[]>(`${this.apiUrl}/dives`).pipe(
      map(dives => dives.map(dive => this.sanitizeDive(dive) as Dive))
    );
  }

  saveDive(dive: DiveDraft): Observable<Dive> {
    const cleaned = this.prepareForBackend(dive);
    return this.http.post<Dive>(`${this.apiUrl}/dives`, cleaned).pipe(
      map(saved => this.sanitizeDive(saved) as Dive),
      tap(() => this.setDraftDive(null))
    );
  }

  uploadImage(file: File): Observable<DiveDraft> {
    const formData = new FormData();
    formData.append('image', file, file.name);
    return this.http.post<DiveDraft>(`${this.apiUrl}/upload`, formData).pipe(
      map(draft => this.sanitizeDive(draft)),
      tap(draft => this.setDraftDive(draft))
    );
  }

  setDraftDive(dive: DiveDraft | null): void {
    this.draftDiveSubject.next(dive);
  }

  getDraftDive(): DiveDraft | null {
    return this.draftDiveSubject.value;
  }

  private sanitizeDive(dive: Partial<DiveDraft> & { id?: number; created_at?: string }): DiveDraft | Dive {
    const base = {
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
      stempel: Array.isArray(dive.stempel) ? dive.stempel : []
    };

    if (dive.id !== undefined && dive.created_at !== undefined) {
      return {
        ...base,
        id: dive.id,
        created_at: dive.created_at
      } as Dive;
    }
    return base;
  }

  private prepareForBackend(dive: DiveDraft): Partial<DiveDraft> {
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
  }
}
```

### C. Proposed Test Suite Specs

#### i. Routing Tests (`frontend/src/app/app-routing.module.spec.ts`)
```typescript
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { RouterTestingModule } from '@angular/router/testing';
import { Component } from '@angular/core';
import { routes } from './app-routing.module';

@Component({ template: '<router-outlet></router-outlet>' })
class MockAppComponent {}

@Component({ template: '' })
class MockUploadComponent {}

@Component({ template: '' })
class MockVerificationComponent {}

@Component({ template: '' })
class MockListComponent {}

describe('Routing Configuration', () => {
  let router: Router;
  let location: Location;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        RouterTestingModule.withRoutes(routes)
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

  it('should redirect empty route to /list', fakeAsync(() => {
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

  it('should redirect /verify to /verification', fakeAsync(() => {
    router.navigate(['/verify']);
    tick();
    expect(location.path()).toBe('/verification');
  }));

  it('should navigate to /list', fakeAsync(() => {
    router.navigate(['/list']);
    tick();
    expect(location.path()).toBe('/list');
  }));

  it('should redirect /dives to /list', fakeAsync(() => {
    router.navigate(['/dives']);
    tick();
    expect(location.path()).toBe('/list');
  }));

  it('should redirect unknown wildcard path to /list', fakeAsync(() => {
    router.navigate(['/some-random-unknown-page']);
    tick();
    expect(location.path()).toBe('/list');
  }));
});
```

#### ii. Service Tests (`frontend/src/app/services/dive.service.spec.ts`)
```typescript
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { DiveService, DiveDraft, Dive } from './dive.service';

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

  describe('Shared State', () => {
    it('should set, get, and clear draft dive state', () => {
      const mockDraft: DiveDraft = {
        tauchgang_nr: 1,
        ort: 'El Minya wreck',
        datum: '2026-06-21',
        sicht: null,
        gewicht_kg: null,
        dauer_min: null,
        tiefe_m: null,
        temperatur_c: null,
        stroemung: null,
        unterschrift_partner: null,
        stempel: []
      };

      expect(service.getDraftDive()).toBeNull();
      service.setDraftDive(mockDraft);
      expect(service.getDraftDive()).toEqual(mockDraft);
      service.setDraftDive(null);
      expect(service.getDraftDive()).toBeNull();
    });
  });

  describe('API Calls', () => {
    it('should perform GET /api/dives and sanitize response attributes', () => {
      const mockBackendResponse = [
        {
          id: 42,
          tauchgang_nr: 527,
          ort: 'Dahab Blue Hole',
          datum: '2026-06-20',
          stempel: null,
          created_at: '2026-06-21T20:42:00Z'
        }
      ];

      service.getDives().subscribe(dives => {
        expect(dives.length).toBe(1);
        expect(dives[0].id).toBe(42);
        expect(dives[0].stempel).toEqual([]); // mapped null to empty array
      });

      const req = httpMock.expectOne('/api/dives');
      expect(req.request.method).toBe('GET');
      req.flush(mockBackendResponse);
    });

    it('should upload log image (POST /api/upload) using FormData', () => {
      const mockFile = new File(['image-binary-data'], 'dive_log_photo.jpg', { type: 'image/jpeg' });
      const mockResponse: DiveDraft = {
        tauchgang_nr: null,
        ort: 'Mocked Extracted Location',
        datum: '2026-06-22',
        sicht: null,
        gewicht_kg: null,
        dauer_min: null,
        tiefe_m: null,
        temperatur_c: null,
        stroemung: null,
        unterschrift_partner: null,
        stempel: []
      };

      service.uploadImage(mockFile).subscribe(draft => {
        expect(draft.ort).toBe('Mocked Extracted Location');
        expect(service.getDraftDive()).toEqual(draft); // Stored in state
      });

      const req = httpMock.expectOne('/api/upload');
      expect(req.request.method).toBe('POST');
      expect(req.request.body instanceof FormData).toBeTrue();
      expect(req.request.body.has('image')).toBeTrue();
      req.flush(mockResponse);
    });

    it('should POST /api/dives with sanitized and coerced inputs', () => {
      const inputDraft: DiveDraft = {
        tauchgang_nr: 101.9, // Should round to 102
        ort: '  Marsa Alam  ',
        datum: '2026-06-20',
        sicht: '  ', // Should convert to null
        gewicht_kg: undefined as any, // Should convert to null
        dauer_min: 42,
        tiefe_m: 18.5,
        temperatur_c: null,
        stroemung: '', // Should convert to null
        unterschrift_partner: null,
        stempel: ['Scuba Club', '   ', 'Another Stamp'] // Empty stamp filters out
      };

      const expectedSavedResponse: Dive = {
        id: 15,
        tauchgang_nr: 102,
        ort: 'Marsa Alam',
        datum: '2026-06-20',
        sicht: null,
        gewicht_kg: null,
        dauer_min: 42,
        tiefe_m: 18.5,
        temperatur_c: null,
        stroemung: null,
        unterschrift_partner: null,
        stempel: ['Scuba Club', 'Another Stamp'],
        created_at: '2026-06-22T08:00:00Z'
      };

      service.saveDive(inputDraft).subscribe(saved => {
        expect(saved).toEqual(expectedSavedResponse);
        expect(service.getDraftDive()).toBeNull(); // Cleared after save
      });

      const req = httpMock.expectOne('/api/dives');
      expect(req.request.method).toBe('POST');
      
      // Check payload conversion before forwarding to server
      expect(req.request.body.tauchgang_nr).toBe(102);
      expect(req.request.body.ort).toBe('Marsa Alam');
      expect(req.request.body.sicht).toBeNull();
      expect(req.request.body.gewicht_kg).toBeNull();
      expect(req.request.body.stroemung).toBeNull();
      expect(req.request.body.stempel).toEqual(['Scuba Club', 'Another Stamp']);

      req.flush(expectedSavedResponse);
    });
  });
});
```

---

## 6. Verification Method

1. **Angular Initialization**:
   - Run the setup steps to create the `frontend/` workspace folder.
   - Run the compiler build command `npx ng build` inside `frontend/` to confirm that the generated structure compiles cleanly with no TypeScript errors.
2. **Unit Test Execution**:
   - Run unit tests inside the `frontend` folder:
     ```bash
     npx ng test --watch=false --browsers=ChromeHeadless
     ```
   - Confirm that all unit tests (routing and service tests) pass successfully.

---

## 7. Action Plan for the Implementer

1. **Initialize Workspace**: Run from root directory:
   ```bash
   npx @angular/cli@17 new frontend --routing --style=css --standalone=false --ssr=false --skip-git
   ```
2. **Generate Sub-components**:
   ```bash
   cd frontend
   npx ng generate component components/upload --skip-tests=false
   npx ng generate component components/verification --skip-tests=false
   npx ng generate component components/list --skip-tests=false
   ```
3. **Generate Service**:
   ```bash
   npx ng generate service services/dive --skip-tests=false
   ```
4. **Proxy Config setup**:
   - Create `frontend/proxy.conf.json`:
     ```json
     {
       "/api": {
         "target": "http://localhost:3000",
         "secure": false
       }
     }
     ```
   - Register it in `frontend/angular.json` under `projects -> frontend -> architect -> serve -> options` with `"proxyConfig": "proxy.conf.json"`.
5. **App Module Configuration**:
   - Register `HttpClientModule` and `ReactiveFormsModule` inside `frontend/src/app/app.module.ts`.
6. **Implement Code Templates**:
   - Populate `app-routing.module.ts` using the template in **Section 5.A**.
   - Create routing spec `app-routing.module.spec.ts` using the template in **Section 5.C.i**.
   - Populate `services/dive.service.ts` using the template in **Section 5.B**.
   - Populate `services/dive.service.spec.ts` using the template in **Section 5.C.ii**.
7. **Verify**:
   - Install packages: `npm install`
   - Run unit tests: `npx ng test --watch=false --browsers=ChromeHeadless`
