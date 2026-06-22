# Milestone 5: Frontend Core & Services Implementation Strategy

## 1. Observation
During the read-only investigation, the following observations were made regarding the codebase:
1. The project root is `/home/daniel/IdeaProjects/digital-dive-log`.
2. Running `ls -la` and `find` shows the current repository contains a backend application inside `backend/` and E2E tests inside `e2e/`. There is currently no `frontend/` directory present in the workspace.
3. The file `PROJECT.md` at line 52 outlines the expected layout for the frontend application:
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
   │   ├── angular.json
   │   ├── package.json        # Frontend dependencies and scripts
   │   └── README.md
   ```
4. In `backend/src/routes.js` and `e2e/mock-server.js`, the API exposes:
   - `POST /api/upload` - expects `multipart/form-data` with `image` file and returns OCR extraction result.
   - `POST /api/dives` - expects `application/json` payload representing a dive log and returns 201 Created status with the saved record.
   - `GET /api/dives` - returns an array of saved dive logs with `id` and `created_at` timestamp.
   - `POST /api/mock/reset` - resets the database state to a baseline dive.

---

## 2. Logic Chain
1. Since the `frontend/` directory does not yet exist (Observation 2), the first step of the implementation strategy must be scaffolding/initializing an Angular workspace inside a new folder named `frontend/` at the project root.
2. Based on the target layout in `PROJECT.md` (Observation 3), we need to set up three key routing destinations: `/list` for listing history, `/upload` for triggering upload, and `/verify` for validating extracted data.
3. To configure these routes, we must design the application routing module (`app-routing.module.ts`) mapping the paths to placeholders/stubs of these components.
4. To communicate with the backend server running on port 3000 (`e2e/mock-server.js`), Angular needs to issue HTTP calls. In a development environment, it is best to use a proxy configuration (`proxy.conf.json`) mapping `/api` to `http://localhost:3000` to avoid CORS issues and hardcoded base URLs in the frontend code.
5. In `dive.service.ts`, we need to implement three methods wrapping `HttpClient`:
   - `uploadImage(file: File)`: Needs to package the file into a `FormData` object with the key name `'image'` as expected by the backend routes (Observation 4).
   - `saveDive(dive: any)`: Needs to post JSON representation of the dive to `/api/dives`.
   - `getDives()`: Needs to fetch lists of dives via a `GET` request to `/api/dives`.
6. Unit tests for `DiveService` should be placed in `dive.service.spec.ts`, utilizing Angular's `HttpClientTestingModule` and `HttpTestingController` to mock network responses and verify HTTP methods, endpoints, payloads, and response propagation.

---

## 3. Caveats
- **Angular Scaffolding**: Since we do not execute commands to scaffold the project directly, we assume the Implementer has Angular CLI (`@angular/cli`) installed globally or will use `npx @angular/cli`.
- **Base URL and Port**: The backend runs on port 3000. If the proxy configuration is not loaded during development (e.g., if using a custom server config), relative URLs `/api/...` in the service will fail. The strategy provides the detailed `proxy.conf.json` implementation.
- **Unit Testing Framework**: Angular defaults to Jasmine/Karma. If the project team decides to adopt Jest or another runner, minor configuration details in imports or mock syntax may vary, though standard Angular unit testing library `HttpClientTestingModule` remains identical.

---

## 4. Conclusion & Proposed Implementation Plan
The proposed implementation strategy requires creating/scaffolding the Angular workspace, adding routing, implementing `DiveService`, and writing unit tests. 

### A. Scaffolding the Frontend
The implementer should execute:
```bash
# In the project root directory
npx -p @angular/cli ng new frontend --routing=true --style=css --skip-tests=false --skip-git=true
```
This generates the workspace layout mapped to `PROJECT.md`. Then inside `frontend/`, create components:
```bash
npx ng generate component components/upload --project=frontend
npx ng generate component components/verification --project=frontend
npx ng generate component components/list --project=frontend
npx ng generate service services/dive --project=frontend
```

### B. Angular Proxy Configuration (`frontend/proxy.conf.json`)
Create `frontend/proxy.conf.json` to proxy API requests:
```json
{
  "/api": {
    "target": "http://localhost:3000",
    "secure": false,
    "logLevel": "debug"
  }
}
```
Update `frontend/angular.json` under `projects -> frontend -> architect -> serve -> options`:
```json
"proxyConfig": "proxy.conf.json"
```

### C. App Routing Module Configuration (`frontend/src/app/app-routing.module.ts`)
Proposed implementation:
```typescript
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListComponent } from './components/list/list.component';
import { UploadComponent } from './components/upload/upload.component';
import { VerificationComponent } from './components/verification/verification.component';

const routes: Routes = [
  { path: '', redirectTo: '/list', pathMatch: 'full' },
  { path: 'list', component: ListComponent },
  { path: 'upload', component: UploadComponent },
  { path: 'verify', component: VerificationComponent },
  { path: '**', redirectTo: '/list' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
```

### D. App Module Configuration (`frontend/src/app/app.module.ts`)
Ensure `HttpClientModule` is imported to support `DiveService`:
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

### E. DiveService Implementation (`frontend/src/app/services/dive.service.ts`)
Proposed implementation:
```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DiveService {
  private readonly baseUrl = '/api';

  constructor(private http: HttpClient) { }

  /**
   * Upload logbook image for OCR extraction
   * @param file Image file to upload
   */
  uploadImage(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('image', file, file.name);
    return this.http.post<any>(`${this.baseUrl}/upload`, formData);
  }

  /**
   * Save verified dive record to the SQLite database
   * @param dive Dive log details
   */
  saveDive(dive: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/dives`, dive);
  }

  /**
   * Fetch all historical dive logs
   */
  getDives(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/dives`);
  }
}
```

### F. DiveService Unit Tests (`frontend/src/app/services/dive.service.spec.ts`)
Proposed implementation:
```typescript
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { DiveService } from './dive.service';

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

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('#uploadImage', () => {
    it('should post multipart/form-data image and return extracted dive data', () => {
      const mockFile = new File([''], 'test-log.png', { type: 'image/png' });
      const mockResponse = {
        tauchgang_nr: 527,
        ort: 'Dahab Blue Hole',
        datum: '2026-06-20',
        sicht: '20m',
        gewicht_kg: 8.0,
        dauer_min: 45,
        tiefe_m: 28.5,
        temperatur_c: 24,
        stroemung: 'mild',
        unterschrift_partner: 'John Doe',
        stempel: ['Scuba Club Dahab', '2026-06-20']
      };

      service.uploadImage(mockFile).subscribe(response => {
        expect(response).toEqual(mockResponse);
      });

      const req = httpMock.expectOne('/api/upload');
      expect(req.request.method).toBe('POST');
      expect(req.request.body instanceof FormData).toBe(true);
      expect(req.request.body.has('image')).toBe(true);
      req.flush(mockResponse);
    });
  });

  describe('#saveDive', () => {
    it('should post dive JSON and return the saved dive record', () => {
      const mockDive = {
        tauchgang_nr: 527,
        ort: 'Dahab Blue Hole',
        datum: '2026-06-20'
      };
      const mockResponse = {
        id: 2,
        ...mockDive,
        created_at: '2026-06-21T20:42:00Z'
      };

      service.saveDive(mockDive).subscribe(response => {
        expect(response).toEqual(mockResponse);
      });

      const req = httpMock.expectOne('/api/dives');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(mockDive);
      req.flush(mockResponse, { status: 201, statusText: 'Created' });
    });
  });

  describe('#getDives', () => {
    it('should get all dives', () => {
      const mockResponse = [
        {
          id: 1,
          tauchgang_nr: 527,
          ort: 'Dahab Blue Hole',
          datum: '2026-06-20'
        }
      ];

      service.getDives().subscribe(response => {
        expect(response).toEqual(mockResponse);
      });

      const req = httpMock.expectOne('/api/dives');
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);
    });
  });
});
```

---

## 5. Verification Method
To independently verify the implementation after code creation:

1. **Workspace Layout Inspection**:
   Verify that all directories match the structure:
   - `frontend/src/app/app-routing.module.ts` exists.
   - `frontend/src/app/services/dive.service.ts` exists.
   - `frontend/src/app/services/dive.service.spec.ts` exists.

2. **Compilation/Build Verification**:
   Navigate to the `frontend/` directory and compile the application:
   ```bash
   cd frontend
   npm run build
   ```
   Ensure the build completes with no compilation errors.

3. **Service Unit Testing**:
   Execute the Angular test suite:
   ```bash
   cd frontend
   npm run test -- --watch=false
   ```
   Ensure all three test groups (`#uploadImage`, `#saveDive`, `#getDives`) inside `dive.service.spec.ts` pass successfully.
