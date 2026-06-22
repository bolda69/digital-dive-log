# Handoff Report: Milestone 5 - Frontend Core & Services

## 1. Observation
- **Frontend Codebase Absence**: The root directory listing for `/home/daniel/IdeaProjects/digital-dive-log` contains only backend, e2e, node_modules, and metadata folders. There is no `frontend` directory.
  - Verbatim list result:
    ```json
    {"name":".agents", "isDir":true}
    {"name":".env", "sizeBytes":"61"}
    {"name":"PROJECT.md", "sizeBytes":"6594"}
    {"name":"backend", "isDir":true}
    {"name":"e2e", "isDir":true}
    {"name":"node_modules", "isDir":true}
    {"name":"package.json", "sizeBytes":"458"}
    ```
- **Monorepo Layout**: The root `package.json` does not configure npm workspaces or monorepo tools, which implies the `frontend` folder must run as an independent npm module with its own dependencies and configuration.
- **Server Configuration**: `backend/src/server.js:6` listens on port 3000:
  ```javascript
  const PORT = process.env.PORT || 3000;
  ```
- **API Base Route**: `backend/src/app.js:20` mounts the backend API routes with prefix `/api`:
  ```javascript
  app.use('/api', routes);
  ```
- **Numeric Fields Constraints**: `backend/src/routes.js:114-124` validates numeric fields:
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
  - This requires that any numeric values sent to `POST /api/dives` must be finite numbers or `null`/`undefined`. Empty strings (`""`) will trigger a `400 Bad Request` since `Number.isFinite("")` evaluates to `false` in the backend validation.
- **Stempel Constraint**: `backend/src/routes.js:135-144` verifies `stempel`:
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
- **Multipart Form Upload**: `backend/src/routes.js:20` defines the single file upload field:
  ```javascript
  const uploadSingle = upload.single('image');
  ```
  - The frontend must post multipart data containing the file under the key `image`.
- **Project Structure**: `PROJECT.md` lines 52-66 requires an NgModule-based Angular architecture featuring an `app.module.ts`:
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
1. **Frontend Initialization**:
   - Because `frontend` does not exist, it must be created.
   - Because terminal test executions for a global `ng` command failed or were blocked, the worker cannot assume `ng` is globally installed. Therefore, initializing the project using `npx @angular/cli@17` is the most robust and portable approach.
   - Because `PROJECT.md` specifies an `app.module.ts` layout and modern Angular CLI (v17+) defaults to standalone components, we must run the generator with `--standalone=false` (e.g. `npx @angular/cli@17 new frontend --routing --style=css --standalone=false --ssr=false`). This ensures the app structure matches `PROJECT.md`.
2. **File Structure Proposals**:
   - In alignment with `PROJECT.md`, the folders `components/upload`, `components/verification`, `components/list`, and `services/` must be generated.
3. **Routing Configuration**:
   - We need specific routes:
     - `/upload` -> `UploadComponent`
     - `/verification` -> `VerificationComponent`
     - `/list` -> `ListComponent`
     - Wildcard and root redirect paths should route users to `/list` to see historical dives as the baseline entry state.
4. **DiveService Logic**:
   - **Endpoint Mapping**:
     - `GET /api/dives` -> maps to `getDives(): Observable<Dive[]>`
     - `POST /api/dives` -> maps to `saveDive(dive: DiveDraft): Observable<Dive>`
     - `POST /api/upload` -> maps to `uploadImage(file: File): Observable<DiveDraft>`
   - **Sanitization & Coercion**:
     - Input elements (especially from forms) often bind empty strings (`""`) when cleared or left blank.
     - Sending empty strings for numeric fields (`tauchgang_nr`, `dauer_min`, `tiefe_m`, `gewicht_kg`, `temperatur_c`) or `stempel` arrays violates backend validator contracts and triggers 400 errors.
     - Therefore, `DiveService` must sanitize input payloads by converting empty strings (`""`) to `null` and rounding integers (like `dauer_min`, `tauchgang_nr`, `temperatur_c`) before posting to `POST /api/dives`.
   - **Data Sharing**:
     - `POST /api/upload` returns the extracted data matching `DiveDraft`. The `UploadComponent` needs to pass this response to the `VerificationComponent`.
     - `DiveService` should store this draft response in a shared state variable (`extractedDive`) so that `VerificationComponent` can fetch it upon navigation, ensuring clean decoupling between the pages.
5. **Testing Strategy**:
   - Routing tests should verify redirection behavior (`''` -> `/list` and `**` -> `/list`) and target component loads.
   - Service tests should verify payload integrity, validation coercion logic (e.g. converting `""` to `null`), and proper creation of `FormData` for uploads.

---

## 3. Caveats
- **Angular Version**: The instructions propose `@angular/cli@17` as a baseline since it is widely used and supports the `--standalone=false` flag. If a newer Angular version is installed and does not support `--standalone=false` natively, the worker must construct `AppModule` manually and adjust `main.ts` accordingly.
- **Reverse Proxy / CORS**: We assume the local dev server will either use Angular's built-in proxy configuration (`proxy.conf.json`) to forward `/api` requests to `http://localhost:3000` or configure CORS in the backend. Since `backend/src/app.js:8` already enables CORS (`app.use(cors())`), the frontend service can directly call `http://localhost:3000/api` during development, or configure a proxy.

---

## 4. Conclusion
We have verified that the frontend needs to be initialized as a separate npm workspace under the folder `frontend`. To follow `PROJECT.md` constraints:
- Use `npx @angular/cli@17 new frontend --routing --style=css --standalone=false --ssr=false` to initialize.
- Map routing paths explicitly in `app-routing.module.ts` for `/upload`, `/verification`, and `/list`.
- Implement `DiveService` to manage HTTP calls, shared upload draft state, and sanitize properties (coercing strings to numbers and empty values to `null`) to prevent backend validation errors.
- Verify everything via automated unit tests for routing and `DiveService` using `HttpTestingController` and `RouterTestingModule`.

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

  // Shared state methods for transferring data from UploadComponent to VerificationComponent
  setExtractedDive(dive: DiveDraft): void {
    this.extractedDive = dive;
  }

  getExtractedDive(): DiveDraft | null {
    return this.extractedDive;
  }

  clearExtractedDive(): void {
    this.extractedDive = null;
  }

  // HTTP API Calls
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
   * Sanitizes form values to match the backend expectations in PROJECT.md.
   * Specifically, empty strings are converted to null for optional fields,
   * and numeric values are verified and coerced.
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

  describe('Shared State Management', () => {
    it('should set, get, and clear extracted dive', () => {
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

  describe('API Interactions', () => {
    it('should retrieve all dives (GET /api/dives)', () => {
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

    it('should upload a dive log image (POST /api/upload)', () => {
      const mockFile = new File(['mock content'], 'test-log.png', { type: 'image/png' });
      const mockDraft: DiveDraft = {
        ort: 'Dahab Blue Hole',
        datum: '2026-06-20',
        tauchgang_nr: 527
      };

      service.uploadImage(mockFile).subscribe((draft) => {
        expect(draft).toEqual(mockDraft);
      });

      const req = httpMock.expectOne(`${apiUrl}/upload`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body instanceof FormData).toBeTrue();
      expect(req.request.body.has('image')).toBeTrue();
      req.flush(mockDraft);
    });

    it('should save a verified dive (POST /api/dives) and sanitize fields', () => {
      const inputDraft: DiveDraft = {
        ort: '  Dahab Blue Hole  ',
        datum: '2026-06-20',
        tauchgang_nr: 527,
        sicht: '', // Should be converted to null
        gewicht_kg: undefined, // Should be omitted/null
        dauer_min: 45.2, // Should be rounded to 45 (integer)
        tiefe_m: 28.5,
        temperatur_c: null, // Should be null
        stempel: ['Club', ''] // Empty string items should be filtered
      };

      const expectedSaved: Dive = {
        id: 1,
        tauchgang_nr: 527,
        ort: 'Dahab Blue Hole',
        datum: '2026-06-20',
        sicht: null,
        gewicht_kg: null,
        dauer_min: 45,
        tiefe_m: 28.5,
        temperatur_c: null,
        stroemung: null,
        unterschrift_partner: null,
        stempel: ['Club'],
        created_at: '2026-06-21T20:42:00Z'
      };

      service.saveDive(inputDraft).subscribe((saved) => {
        expect(saved).toEqual(expectedSaved);
      });

      const req = httpMock.expectOne(`${apiUrl}/dives`);
      expect(req.request.method).toBe('POST');
      
      // Verify sanitization before request was made
      expect(req.request.body.ort).toBe('Dahab Blue Hole');
      expect(req.request.body.sicht).toBeNull();
      expect(req.request.body.dauer_min).toBe(45);
      expect(req.request.body.stempel).toEqual(['Club']);
      
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

describe('App Routing', () => {
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

  it('should redirect wildcard path to /list', fakeAsync(() => {
    router.navigate(['/some/unknown/path']);
    tick();
    expect(location.path()).toBe('/list');
  }));
});
```

---

## 6. Verification Method
1. **Initialize the Angular app**: Run the initialization command outlined in Section 7.
2. **Compile the App**: Run `npm run build` or `ng build` inside the `frontend` directory. Verify that no TypeScript or compilation errors occur.
3. **Execute Unit Tests**:
   - Run `npm run test` or `ng test --watch=false --browsers=ChromeHeadless` inside the `frontend` folder.
   - Verify that all test cases for routing and `DiveService` pass successfully with 100% success rate.

---

## 7. Action Plan for the Worker
1. **Step 1**: Initialize a clean Angular project named `frontend` using the command:
   ```bash
   npx @angular/cli@17 new frontend --routing --style=css --standalone=false --ssr=false
   ```
   *Note: Accept default options when prompted.*
2. **Step 2**: Change working directory to `frontend`.
3. **Step 3**: Generate the view components and services:
   ```bash
   npx ng generate component components/upload --skip-tests=false
   npx ng generate component components/verification --skip-tests=false
   npx ng generate component components/list --skip-tests=false
   npx ng generate service services/dive --skip-tests=false
   ```
4. **Step 4**: Implement the routing logic by overwriting `frontend/src/app/app-routing.module.ts` using the template in Section 5.2.
5. **Step 5**: Create the routing unit test file at `frontend/src/app/app-routing.module.spec.ts` using the template in Section 5.5.
6. **Step 6**: Generate the environments configuration (since Angular CLI v17+ does not generate them by default):
   ```bash
   npx ng generate environments
   ```
   - In `frontend/src/environments/environment.development.ts`, set `apiUrl: 'http://localhost:3000/api'`.
   - In `frontend/src/environments/environment.ts`, set `apiUrl: '/api'`.
7. **Step 7**: Update `frontend/src/app/services/dive.service.ts` with the interface contracts and sanitization logic from Section 5.3.
8. **Step 8**: Update `frontend/src/app/services/dive.service.spec.ts` with the mocks and tests from Section 5.4.
9. **Step 9**: Update `frontend/src/app/app.module.ts` to include `HttpClientModule`, `FormsModule`, and `ReactiveFormsModule` imports.
10. **Step 10**: Verify execution: Run `npm install` followed by `npm run test` or `npx ng test --watch=false` to confirm all core/routing tests execute and pass correctly.
