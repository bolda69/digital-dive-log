# Handoff Report: Milestone 6 Frontend View Components

## 1. Observation

- **Project Structure**:
  - Main frontend directory is `/home/daniel/IdeaProjects/digital-dive-log/frontend`.
  - The Angular application utilizes standard Routing and Module structures under `frontend/src/app/`.
  - Scaffolded component templates and stub classes exist under:
    - `frontend/src/app/components/upload/`
    - `frontend/src/app/components/verification/`
    - `frontend/src/app/components/list/`
  - Current unit tests under these directories are basic stubs checking only component instantiation (`expect(component).toBeTruthy();`).
- **Module and Router Configuration**:
  - `app.module.ts` imports `BrowserModule`, `AppRoutingModule`, `HttpClientModule`, `FormsModule`, and `ReactiveFormsModule`.
  - `app-routing.module.ts` defines routing tables mapping path strings to components:
    - `/upload` loads `UploadComponent`
    - `/verification` (and redirect `/verify`) loads `VerificationComponent`
    - `/list` (and redirects `/dives`, `""`, `**`) loads `ListComponent`
- **Service Layer Contracts**:
  - `frontend/src/app/services/dive.service.ts` exposes:
    - `draftDive$` (Observable) and `getDraftDive(): DiveDraft | null` for sharing intermediate draft states.
    - `uploadImage(file: File): Observable<DiveDraft>` to upload log photos (using `FormData` key `image`), update internal draft state, and return the extracted JSON.
    - `saveDive(dive: DiveDraft): Observable<Dive>` to clean, coerce, and persist verified dive data to the DB, clearing the draft state on success.
    - `getDives(): Observable<Dive[]>` to fetch historical dives.
- **Backend API Rules (from `backend/src/routes.js` & E2E tests)**:
  - `ort`: Required, string, non-empty, max 1000 characters.
  - `datum`: Required, string in `YYYY-MM-DD` format, must be a valid calendar date.
  - Optional strings (`sicht`, `stroemung`, `unterschrift_partner`): Max 1000 characters.
  - Numbers (`tauchgang_nr`, `dauer_min`, `tiefe_m`, `gewicht_kg`, `temperatur_c`): Must be finite, >= 0, <= 100000.
  - Integers (`tauchgang_nr`, `dauer_min`, `temperatur_c`): Must not have decimals on submit (handled by `DiveService` coercion, but validated on client).
  - Special bound: `tiefe_m` must be <= 11000 (Mariana Trench boundary check).
  - `stempel`: Must be an array of strings.

## 2. Logic Chain

- **Unified State and Navigation Flow**:
  - The flow is defined as: **Upload -> Verify/Correct -> List**.
  - `UploadComponent` sends an image to the backend via `DiveService.uploadImage()`. The response is cached in the service's `draftDive$` BehaviorSubject, and the component routes to `/verification`.
  - `VerificationComponent` reads this subject to populate its reactive form. Validations are enforced on client inputs before submission.
  - Submitting the form calls `DiveService.saveDive()`, which posts to `/api/dives`, clears the service draft, and navigates to `/list`.
  - `ListComponent` retrieves all logged dives on initialization, sorts them chronologically (newest first), and formats them in a clear responsive table.
- **Data Integrity and Coercion**:
  - Direct form binding using `ReactiveFormsModule` ensures inputs are parsed cleanly.
  - Numeric fields must be bound with `<input type="number">` with `min="0"` and appropriate steps to prevent invalid negative values.
  - Date inputs must be bound to HTML5 `<input type="date">` to guarantee the native `YYYY-MM-DD` format without timezone shifts.
- **Test Strategy**:
  - Using mocked versions of `Router` and `DiveService` isolates component behavior from network request timing and routing cycles.
  - Subscribing to the reactive forms validation state lets tests programmatically assert form field errors, ensuring invalid data (negative values, empty required strings) disables the submit button.

## 3. Caveats

- **Timezone shifts on Date Picker**: Standard HTML5 date inputs output `YYYY-MM-DD` string in local browser time. Care must be taken if parsing strings into JavaScript Date objects before submission, as UTC conversions might shift dates by one day. The designs bypass this issue by keeping the date value strictly as a string.
- **Stempel array type consistency**: If the OCR returns null for stamps, `DiveService` maps it to `[]`. The client form logic must handle adding and removing from a string array property explicitly.
- **ChromeHeadless Environment in E2E**: Running browser tests locally requires pointing to a valid Chromium executable. Setting `CHROME_BIN` path to the cached Playwright browser directory (e.g. `/home/daniel/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`) is required.

## 4. Conclusion

The views must be implemented using standard Angular practices, utilizing `ReactiveFormsModule` for form controls, template-driven array logic for stamps, and custom sorting pipes or controllers. Below are the complete specifications, markup templates, typescript classes, CSS files, and Jasmine spec files for all three view components.

---

### 4.1 UploadComponent Spec & Templates

#### 4.1.1 `upload.component.html`
```html
<div class="upload-container">
  <h2>Upload Dive Log Photo</h2>
  <p class="description">Upload a photo of your physical dive log sheet to automatically extract its details using OCR.</p>

  <div class="upload-dropzone" 
       [class.dragover]="isDragOver" 
       (dragover)="onDragOver($event)" 
       (dragleave)="onDragLeave()" 
       (drop)="onDrop($event)">
    
    <div class="upload-prompt" *ngIf="!selectedFile && !loading">
      <div class="icon">📁</div>
      <p>Drag & drop your dive log photo here, or</p>
      <input type="file" id="fileInput" accept="image/png, image/jpeg, image/gif" (change)="onFileSelected($event)" style="display: none;">
      <button type="button" class="btn btn-primary" (click)="triggerFileInput()">Select File</button>
    </div>

    <!-- Image Preview Mode -->
    <div class="upload-preview" *ngIf="selectedFile && !loading">
      <div class="preview-meta">
        <span class="file-name">{{ selectedFile.name }} ({{ (selectedFile.size / 1024) | number:'1.0-1' }} KB)</span>
        <button type="button" class="btn btn-danger btn-sm" (click)="clearSelection()">Remove</button>
      </div>
      <img *ngIf="previewUrl" [src]="previewUrl" alt="Selected Dive Log Preview" class="img-thumbnail">
      <div class="preview-actions">
        <button type="button" class="btn btn-success" (click)="uploadImage()">Upload & Analyze</button>
      </div>
    </div>

    <!-- Loading Spinner & Indicator -->
    <div class="upload-loading" *ngIf="loading">
      <div class="spinner"></div>
      <p class="loading-msg">Uploading image and extracting data via OCR. Please wait...</p>
    </div>
  </div>

  <div class="alert alert-danger" *ngIf="errorMessage">
    {{ errorMessage }}
  </div>
</div>
```

#### 4.1.2 `upload.component.css`
```css
.upload-container {
  max-width: 600px;
  margin: 2rem auto;
  padding: 1.5rem;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
.description {
  color: #666;
  margin-bottom: 1.5rem;
}
.upload-dropzone {
  border: 2px dashed #007bff;
  border-radius: 6px;
  padding: 3rem 1.5rem;
  text-align: center;
  background: #f8f9fa;
  transition: all 0.2s ease-in-out;
  cursor: pointer;
}
.upload-dropzone.dragover {
  background: #e2f0fe;
  border-color: #0056b3;
}
.upload-prompt .icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}
.btn {
  padding: 0.5rem 1.2rem;
  font-size: 1rem;
  border-radius: 4px;
  border: none;
  cursor: pointer;
}
.btn-primary { background: #007bff; color: white; }
.btn-primary:hover { background: #0056b3; }
.btn-success { background: #28a745; color: white; }
.btn-success:hover { background: #218838; }
.btn-danger { background: #dc3545; color: white; }
.btn-danger:hover { background: #bd2130; }
.btn-sm { padding: 0.25rem 0.5rem; font-size: 0.85rem; }
.upload-preview img {
  max-width: 100%;
  max-height: 350px;
  margin: 1rem 0;
  border-radius: 4px;
}
.preview-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}
.file-name { font-weight: bold; color: #333; }
.upload-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.spinner {
  border: 4px solid rgba(0,0,0,.1);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border-left-color: #007bff;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
.alert-danger {
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  border-radius: 4px;
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}
```

#### 4.1.3 `upload.component.ts`
```typescript
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { DiveService } from '../../services/dive.service';

@Component({
  selector: 'app-upload',
  templateUrl: './upload.component.html',
  styleUrls: ['./upload.component.css']
})
export class UploadComponent {
  selectedFile: File | null = null;
  previewUrl: string | ArrayBuffer | null = null;
  loading = false;
  errorMessage: string | null = null;
  isDragOver = false;

  constructor(
    private diveService: DiveService,
    private router: Router
  ) {}

  triggerFileInput(): void {
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    fileInput?.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.setFile(input.files[0]);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(): void {
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      this.setFile(event.dataTransfer.files[0]);
    }
  }

  private setFile(file: File): void {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      this.errorMessage = 'Please select a valid image file (PNG, JPG, JPEG, GIF).';
      return;
    }
    this.selectedFile = file;
    this.errorMessage = null;

    const reader = new FileReader();
    reader.onload = () => {
      this.previewUrl = reader.result;
    };
    reader.readAsDataURL(file);
  }

  clearSelection(): void {
    this.selectedFile = null;
    this.previewUrl = null;
    this.errorMessage = null;
  }

  uploadImage(): void {
    if (!this.selectedFile) {
      this.errorMessage = 'No file selected.';
      return;
    }

    this.loading = true;
    this.errorMessage = null;

    this.diveService.uploadImage(this.selectedFile).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/verification']);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = 'Upload failed. The image could not be processed. Please try again.';
        console.error(err);
      }
    });
  }
}
```

#### 4.1.4 `upload.component.spec.ts`
```typescript
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { UploadComponent } from './upload.component';
import { DiveService } from '../../services/dive.service';

describe('UploadComponent', () => {
  let component: UploadComponent;
  let fixture: ComponentFixture<UploadComponent>;
  let diveServiceSpy: jasmine.SpyObj<DiveService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    const serviceSpy = jasmine.createSpyObj('DiveService', ['uploadImage']);
    const rSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      declarations: [UploadComponent],
      imports: [RouterTestingModule],
      providers: [
        { provide: DiveService, useValue: serviceSpy },
        { provide: Router, useValue: rSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(UploadComponent);
    component = fixture.componentInstance;
    diveServiceSpy = TestBed.inject(DiveService) as jasmine.SpyObj<DiveService>;
    routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should handle file selection for valid images', () => {
    const file = new File(['mock content'], 'test.png', { type: 'image/png' });
    const event = { target: { files: [file] } } as unknown as Event;

    component.onFileSelected(event);

    expect(component.selectedFile).toBe(file);
    expect(component.errorMessage).toBeNull();
  });

  it('should reject non-image file formats', () => {
    const file = new File(['mock content'], 'test.pdf', { type: 'application/pdf' });
    const event = { target: { files: [file] } } as unknown as Event;

    component.onFileSelected(event);

    expect(component.selectedFile).toBeNull();
    expect(component.errorMessage).toBe('Please select a valid image file (PNG, JPG, JPEG, GIF).');
  });

  it('should call uploadImage and navigate on success', fakeAsync(() => {
    const file = new File(['mock content'], 'test.png', { type: 'image/png' });
    component.selectedFile = file;
    diveServiceSpy.uploadImage.and.returnValue(of({
      tauchgang_nr: 1,
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
    }));

    component.uploadImage();

    expect(component.loading).toBeTrue();
    tick(); // resolve uploadImage observable

    expect(diveServiceSpy.uploadImage).toHaveBeenCalledWith(file);
    expect(component.loading).toBeFalse();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/verification']);
  }));

  it('should set error message on upload failure', fakeAsync(() => {
    const file = new File(['mock content'], 'test.png', { type: 'image/png' });
    component.selectedFile = file;
    diveServiceSpy.uploadImage.and.returnValue(throwError(() => new Error('Upload error')));

    component.uploadImage();

    expect(component.loading).toBeTrue();
    tick();

    expect(diveServiceSpy.uploadImage).toHaveBeenCalledWith(file);
    expect(component.loading).toBeFalse();
    expect(component.errorMessage).toBe('Upload failed. The image could not be processed. Please try again.');
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  }));
});
```

---

### 4.2 VerificationComponent Spec & Templates

#### 4.2.1 `verification.component.html`
```html
<div class="verification-container">
  <h2>Verify Extracted Dive Data</h2>
  <p class="subtitle">Please check and correct the extracted information below before saving.</p>

  <form [formGroup]="diveForm" (ngSubmit)="onSubmit()" class="verification-form">
    
    <div class="form-grid">
      <!-- Dive Number -->
      <div class="form-group">
        <label for="tauchgang_nr">Dive No. (Tauchgang Nr.)</label>
        <input type="number" id="tauchgang_nr" formControlName="tauchgang_nr" placeholder="e.g. 42" class="form-control">
        <div class="error-msg" *ngIf="diveForm.get('tauchgang_nr')?.touched && diveForm.get('tauchgang_nr')?.invalid">
          <span *ngIf="diveForm.get('tauchgang_nr')?.errors?.['min']">Must be 0 or higher.</span>
          <span *ngIf="diveForm.get('tauchgang_nr')?.errors?.['max']">Value is unreasonably large.</span>
          <span *ngIf="diveForm.get('tauchgang_nr')?.errors?.['pattern']">Must be a whole number.</span>
        </div>
      </div>

      <!-- Location (Ort) - Required -->
      <div class="form-group required">
        <label for="ort">Location (Ort)</label>
        <input type="text" id="ort" formControlName="ort" placeholder="e.g. Red Sea, Egypt" class="form-control">
        <div class="error-msg" *ngIf="diveForm.get('ort')?.touched && diveForm.get('ort')?.invalid">
          <span *ngIf="diveForm.get('ort')?.errors?.['required']">Location is required.</span>
          <span *ngIf="diveForm.get('ort')?.errors?.['maxlength']">Must be at most 1000 characters.</span>
        </div>
      </div>

      <!-- Date (Datum) - Required -->
      <div class="form-group required">
        <label for="datum">Date (Datum)</label>
        <input type="date" id="datum" formControlName="datum" class="form-control">
        <div class="error-msg" *ngIf="diveForm.get('datum')?.touched && diveForm.get('datum')?.invalid">
          <span *ngIf="diveForm.get('datum')?.errors?.['required']">Date is required.</span>
          <span *ngIf="diveForm.get('datum')?.errors?.['invalidDate']">Please select a valid calendar date.</span>
        </div>
      </div>

      <!-- Visibility (Sicht) -->
      <div class="form-group">
        <label for="sicht">Visibility (Sicht)</label>
        <input type="text" id="sicht" formControlName="sicht" placeholder="e.g. 15m" class="form-control">
        <div class="error-msg" *ngIf="diveForm.get('sicht')?.touched && diveForm.get('sicht')?.invalid">
          <span *ngIf="diveForm.get('sicht')?.errors?.['maxlength']">Must be at most 1000 characters.</span>
        </div>
      </div>

      <!-- Weight (Gewicht) -->
      <div class="form-group">
        <label for="gewicht_kg">Weight (Gewicht kg)</label>
        <input type="number" step="0.1" id="gewicht_kg" formControlName="gewicht_kg" placeholder="e.g. 8.0" class="form-control">
        <div class="error-msg" *ngIf="diveForm.get('gewicht_kg')?.touched && diveForm.get('gewicht_kg')?.invalid">
          <span *ngIf="diveForm.get('gewicht_kg')?.errors?.['min']">Must be 0 or higher.</span>
          <span *ngIf="diveForm.get('gewicht_kg')?.errors?.['max']">Value is unreasonably large.</span>
        </div>
      </div>

      <!-- Duration (Dauer) -->
      <div class="form-group">
        <label for="dauer_min">Duration (Dauer min)</label>
        <input type="number" id="dauer_min" formControlName="dauer_min" placeholder="e.g. 45" class="form-control">
        <div class="error-msg" *ngIf="diveForm.get('dauer_min')?.touched && diveForm.get('dauer_min')?.invalid">
          <span *ngIf="diveForm.get('dauer_min')?.errors?.['min']">Must be 0 or higher.</span>
          <span *ngIf="diveForm.get('dauer_min')?.errors?.['max']">Value is unreasonably large.</span>
          <span *ngIf="diveForm.get('dauer_min')?.errors?.['pattern']">Must be a whole number.</span>
        </div>
      </div>

      <!-- Depth (Tiefe) -->
      <div class="form-group">
        <label for="tiefe_m">Depth (Tiefe m)</label>
        <input type="number" step="0.1" id="tiefe_m" formControlName="tiefe_m" placeholder="e.g. 22.4" class="form-control">
        <div class="error-msg" *ngIf="diveForm.get('tiefe_m')?.touched && diveForm.get('tiefe_m')?.invalid">
          <span *ngIf="diveForm.get('tiefe_m')?.errors?.['min']">Must be 0 or higher.</span>
          <span *ngIf="diveForm.get('tiefe_m')?.errors?.['max']">Cannot exceed 11000m.</span>
        </div>
      </div>

      <!-- Temperature (Temperatur) -->
      <div class="form-group">
        <label for="temperatur_c">Temp (Temperatur °C)</label>
        <input type="number" id="temperatur_c" formControlName="temperatur_c" placeholder="e.g. 24" class="form-control">
        <div class="error-msg" *ngIf="diveForm.get('temperatur_c')?.touched && diveForm.get('temperatur_c')?.invalid">
          <span *ngIf="diveForm.get('temperatur_c')?.errors?.['min']">Must be 0 or higher.</span>
          <span *ngIf="diveForm.get('temperatur_c')?.errors?.['max']">Value is unreasonably large.</span>
          <span *ngIf="diveForm.get('temperatur_c')?.errors?.['pattern']">Must be a whole number.</span>
        </div>
      </div>

      <!-- Current (Strömung) -->
      <div class="form-group">
        <label for="stroemung">Current (Strömung)</label>
        <input type="text" id="stroemung" formControlName="stroemung" placeholder="e.g. light, medium, strong" class="form-control">
        <div class="error-msg" *ngIf="diveForm.get('stroemung')?.touched && diveForm.get('stroemung')?.invalid">
          <span *ngIf="diveForm.get('stroemung')?.errors?.['maxlength']">Must be at most 1000 characters.</span>
        </div>
      </div>

      <!-- Buddy/Partner Signature -->
      <div class="form-group">
        <label for="unterschrift_partner">Buddy (Partner/Unterschrift)</label>
        <input type="text" id="unterschrift_partner" formControlName="unterschrift_partner" placeholder="e.g. John Doe" class="form-control">
        <div class="error-msg" *ngIf="diveForm.get('unterschrift_partner')?.touched && diveForm.get('unterschrift_partner')?.invalid">
          <span *ngIf="diveForm.get('unterschrift_partner')?.errors?.['maxlength']">Must be at most 1000 characters.</span>
        </div>
      </div>
    </div>

    <!-- Stamps Section -->
    <div class="stamps-section">
      <label>Stamps (Stempel)</label>
      <div class="stamps-list" *ngIf="stamps.length > 0">
        <span class="stamp-badge" *ngFor="let stamp of stamps; let i = index">
          {{ stamp }}
          <button type="button" class="btn-remove-stamp" (click)="removeStamp(i)">&times;</button>
        </span>
      </div>
      <p class="no-stamps-msg" *ngIf="stamps.length === 0">No stamps identified. Add one below.</p>
      
      <div class="add-stamp-input">
        <input type="text" [(ngModel)]="newStamp" [ngModelOptions]="{standalone: true}" 
               placeholder="Add a stamp keyword..." class="form-control" (keydown.enter)="addStamp($event)">
        <button type="button" class="btn btn-secondary" (click)="addStamp()">Add</button>
      </div>
    </div>

    <!-- Actions -->
    <div class="form-actions">
      <button type="button" class="btn btn-outline" routerLink="/upload" [disabled]="loading">Cancel</button>
      <button type="submit" class="btn btn-success" [disabled]="diveForm.invalid || loading">
        <span *ngIf="!loading">Save Dive Log</span>
        <span *ngIf="loading">Saving...</span>
      </button>
    </div>

    <div class="error-alert" *ngIf="errorMessage">
      <p>{{ errorMessage }}</p>
    </div>
  </form>
</div>
```

#### 4.2.2 `verification.component.css`
```css
.verification-container {
  max-width: 800px;
  margin: 2rem auto;
  padding: 1.5rem;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
.subtitle {
  color: #666;
  margin-bottom: 2rem;
}
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  margin-bottom: 2rem;
}
@media (max-width: 600px) {
  .form-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}
.form-group {
  display: flex;
  flex-direction: column;
}
.form-group.required label::after {
  content: ' *';
  color: #dc3545;
  font-weight: bold;
}
.form-group label {
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #333;
}
.form-control {
  padding: 0.6rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
  transition: border-color 0.15s ease-in-out;
}
.form-control:focus {
  outline: none;
  border-color: #007bff;
}
.error-msg {
  color: #dc3545;
  font-size: 0.85rem;
  margin-top: 0.25rem;
}
.stamps-section {
  border-top: 1px solid #eee;
  padding-top: 1.5rem;
  margin-bottom: 2rem;
}
.stamps-section > label {
  font-weight: 600;
  color: #333;
  display: block;
  margin-bottom: 1rem;
}
.stamps-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}
.stamp-badge {
  background: #e2f0fe;
  color: #0056b3;
  padding: 0.4rem 0.8rem;
  border-radius: 20px;
  font-size: 0.9rem;
  display: inline-flex;
  align-items: center;
  font-weight: 500;
}
.btn-remove-stamp {
  background: none;
  border: none;
  color: #0056b3;
  font-size: 1.2rem;
  line-height: 1;
  margin-left: 0.5rem;
  cursor: pointer;
  padding: 0;
}
.btn-remove-stamp:hover { color: #dc3545; }
.no-stamps-msg { color: #888; font-style: italic; margin-bottom: 1rem; }
.add-stamp-input {
  display: flex;
  gap: 0.5rem;
}
.add-stamp-input input { flex: 1; }
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  border-top: 1px solid #eee;
  padding-top: 1.5rem;
}
.btn-outline {
  background: transparent;
  border: 1px solid #ccc;
  color: #555;
}
.btn-outline:hover:not([disabled]) {
  background: #f8f9fa;
  border-color: #bbb;
}
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.error-alert {
  margin-top: 1.5rem;
  padding: 0.75rem 1rem;
  border-radius: 4px;
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}
```

#### 4.2.3 `verification.component.ts`
```typescript
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { DiveService, DiveDraft } from '../../services/dive.service';

@Component({
  selector: 'app-verification',
  templateUrl: './verification.component.html',
  styleUrls: ['./verification.component.css']
})
export class VerificationComponent implements OnInit, OnDestroy {
  diveForm!: FormGroup;
  stamps: string[] = [];
  newStamp = '';
  loading = false;
  errorMessage: string | null = null;
  private draftSubscription!: Subscription;

  constructor(
    private fb: FormBuilder,
    private diveService: DiveService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initForm();
    
    this.draftSubscription = this.diveService.draftDive$.subscribe(draft => {
      if (draft) {
        this.populateForm(draft);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.draftSubscription) {
      this.draftSubscription.unsubscribe();
    }
  }

  private initForm(): void {
    const textLimit = Validators.maxLength(1000);
    const maxVal = Validators.max(100000);

    this.diveForm = this.fb.group({
      tauchgang_nr: [null, [Validators.min(0), maxVal, Validators.pattern('^[0-9]*$')]],
      ort: ['', [Validators.required, textLimit]],
      datum: ['', [Validators.required, this.dateValidator]],
      sicht: [null, [textLimit]],
      gewicht_kg: [null, [Validators.min(0), maxVal]],
      dauer_min: [null, [Validators.min(0), maxVal, Validators.pattern('^[0-9]*$')]],
      tiefe_m: [null, [Validators.min(0), Validators.max(11000)]],
      temperatur_c: [null, [Validators.min(0), maxVal, Validators.pattern('^[0-9]*$')]],
      stroemung: [null, [textLimit]],
      unterschrift_partner: [null, [textLimit]]
    });
  }

  private populateForm(draft: DiveDraft): void {
    this.diveForm.patchValue({
      tauchgang_nr: draft.tauchgang_nr,
      ort: draft.ort,
      datum: draft.datum,
      sicht: draft.sicht,
      gewicht_kg: draft.gewicht_kg,
      dauer_min: draft.dauer_min,
      tiefe_m: draft.tiefe_m,
      temperatur_c: draft.temperatur_c,
      stroemung: draft.stroemung,
      unterschrift_partner: draft.unterschrift_partner
    });
    this.stamps = draft.stempel ? [...draft.stempel] : [];
  }

  dateValidator(control: AbstractControl): ValidationErrors | null {
    const value = control.value;
    if (!value) return null;
    
    // Check general format YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(value)) {
      return { invalidDate: true };
    }

    // Calendar date integrity bounds
    const parts = value.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);

    if (month < 1 || month > 12) {
      return { invalidDate: true };
    }

    const daysInMonth = new Date(year, month, 0).getDate();
    if (day < 1 || day > daysInMonth) {
      return { invalidDate: true };
    }

    return null;
  }

  addStamp(event?: Event): void {
    if (event) {
      event.preventDefault();
    }
    const tag = this.newStamp.trim();
    if (tag && !this.stamps.includes(tag)) {
      this.stamps.push(tag);
      this.newStamp = '';
    }
  }

  removeStamp(index: number): void {
    this.stamps.splice(index, 1);
  }

  onSubmit(): void {
    if (this.diveForm.invalid) {
      this.diveForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = null;

    const raw = this.diveForm.value;
    const diveDraft: DiveDraft = {
      tauchgang_nr: this.parseNumberOrNull(raw.tauchgang_nr, true),
      ort: raw.ort,
      datum: raw.datum,
      sicht: raw.sicht ? String(raw.sicht).trim() : null,
      gewicht_kg: this.parseNumberOrNull(raw.gewicht_kg, false),
      dauer_min: this.parseNumberOrNull(raw.dauer_min, true),
      tiefe_m: this.parseNumberOrNull(raw.tiefe_m, false),
      temperatur_c: this.parseNumberOrNull(raw.temperatur_c, true),
      stroemung: raw.stroemung ? String(raw.stroemung).trim() : null,
      unterschrift_partner: raw.unterschrift_partner ? String(raw.unterschrift_partner).trim() : null,
      stempel: [...this.stamps]
    };

    this.diveService.saveDive(diveDraft).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/list']);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = 'Failed to save dive. Please verify inputs and try again.';
        console.error(err);
      }
    });
  }

  private parseNumberOrNull(val: any, integer = false): number | null {
    if (val === null || val === undefined || String(val).trim() === '') {
      return null;
    }
    const parsed = Number(val);
    if (isNaN(parsed)) return null;
    return integer ? Math.round(parsed) : parsed;
  }
}
```

#### 4.2.4 `verification.component.spec.ts`
```typescript
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { VerificationComponent } from './verification.component';
import { DiveService, DiveDraft } from '../../services/dive.service';

describe('VerificationComponent', () => {
  let component: VerificationComponent;
  let fixture: ComponentFixture<VerificationComponent>;
  let diveServiceSpy: jasmine.SpyObj<DiveService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let draftDiveSubject: BehaviorSubject<DiveDraft | null>;

  beforeEach(async () => {
    draftDiveSubject = new BehaviorSubject<DiveDraft | null>(null);
    const serviceSpy = jasmine.createSpyObj('DiveService', ['saveDive']);
    serviceSpy.draftDive$ = draftDiveSubject.asObservable();
    serviceSpy.saveDive.and.returnValue(of({
      id: 1,
      tauchgang_nr: 1,
      ort: 'Dahab',
      datum: '2026-06-20',
      sicht: null,
      gewicht_kg: null,
      dauer_min: null,
      tiefe_m: null,
      temperatur_c: null,
      stroemung: null,
      unterschrift_partner: null,
      stempel: [],
      created_at: '2026-06-20'
    }));

    const rSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      declarations: [VerificationComponent],
      imports: [ReactiveFormsModule, FormsModule, RouterTestingModule],
      providers: [
        { provide: DiveService, useValue: serviceSpy },
        { provide: Router, useValue: rSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(VerificationComponent);
    component = fixture.componentInstance;
    diveServiceSpy = TestBed.inject(DiveService) as jasmine.SpyObj<DiveService>;
    routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should populate form when draft is emitted', () => {
    const mockDraft: DiveDraft = {
      tauchgang_nr: 10,
      ort: 'Bells',
      datum: '2026-06-21',
      sicht: '20m',
      gewicht_kg: 8,
      dauer_min: 45,
      tiefe_m: 25,
      temperatur_c: 24,
      stroemung: 'none',
      unterschrift_partner: 'Buddy',
      stempel: ['Stamp 1']
    };

    draftDiveSubject.next(mockDraft);
    fixture.detectChanges();

    expect(component.diveForm.get('ort')?.value).toBe('Bells');
    expect(component.diveForm.get('datum')?.value).toBe('2026-06-21');
    expect(component.stamps).toEqual(['Stamp 1']);
  });

  it('should validate required fields ort and datum', () => {
    const form = component.diveForm;
    form.patchValue({ ort: '', datum: '' });
    expect(form.valid).toBeFalse();
    expect(form.get('ort')?.errors?.['required']).toBeTrue();
    expect(form.get('datum')?.errors?.['required']).toBeTrue();

    form.patchValue({ ort: 'Ort', datum: '2026-06-20' });
    expect(form.valid).toBeTrue();
  });

  it('should reject invalid calendar dates', () => {
    const form = component.diveForm;
    form.patchValue({ ort: 'Dahab', datum: '2026-02-31' }); // Feb doesn't have 31 days
    expect(form.valid).toBeFalse();
    expect(form.get('datum')?.errors?.['invalidDate']).toBeTrue();
  });

  it('should validate numeric fields cannot be negative', () => {
    const form = component.diveForm;
    form.patchValue({
      ort: 'Dahab',
      datum: '2026-06-20',
      tauchgang_nr: -1,
      gewicht_kg: -2.5,
      dauer_min: -10,
      tiefe_m: -15,
      temperatur_c: -5
    });

    expect(form.valid).toBeFalse();
    expect(form.get('tauchgang_nr')?.errors?.['min']).toBeDefined();
    expect(form.get('gewicht_kg')?.errors?.['min']).toBeDefined();
    expect(form.get('dauer_min')?.errors?.['min']).toBeDefined();
    expect(form.get('tiefe_m')?.errors?.['min']).toBeDefined();
    expect(form.get('temperatur_c')?.errors?.['min']).toBeDefined();
  });

  it('should validate integer pattern for tauchgang_nr, dauer_min, and temperatur_c', () => {
    const form = component.diveForm;
    form.patchValue({
      ort: 'Dahab',
      datum: '2026-06-20',
      tauchgang_nr: 1.5,
      dauer_min: 45.5,
      temperatur_c: 22.4
    });

    expect(form.valid).toBeFalse();
    expect(form.get('tauchgang_nr')?.errors?.['pattern']).toBeDefined();
    expect(form.get('dauer_min')?.errors?.['pattern']).toBeDefined();
    expect(form.get('temperatur_c')?.errors?.['pattern']).toBeDefined();
  });

  it('should enforce depth <= 11000m', () => {
    const form = component.diveForm;
    form.patchValue({
      ort: 'Dahab',
      datum: '2026-06-20',
      tiefe_m: 12000
    });
    expect(form.valid).toBeFalse();
    expect(form.get('tiefe_m')?.errors?.['max']).toBeDefined();
  });

  it('should manage stamp list: adding and removing stamps', () => {
    component.stamps = ['Existing'];
    component.newStamp = '  New Stamp  ';
    component.addStamp();
    expect(component.stamps).toEqual(['Existing', 'New Stamp']);
    expect(component.newStamp).toBe('');

    component.removeStamp(0);
    expect(component.stamps).toEqual(['New Stamp']);
  });

  it('should call saveDive and navigate on submit success', fakeAsync(() => {
    const form = component.diveForm;
    form.patchValue({
      tauchgang_nr: 10,
      ort: 'Bells',
      datum: '2026-06-21',
      sicht: '20m',
      gewicht_kg: 8,
      dauer_min: 45,
      tiefe_m: 25,
      temperatur_c: 24,
      stroemung: 'none',
      unterschrift_partner: 'Buddy'
    });
    component.stamps = ['Stamp 1'];

    component.onSubmit();
    expect(component.loading).toBeTrue();
    tick();

    expect(diveServiceSpy.saveDive).toHaveBeenCalled();
    expect(component.loading).toBeFalse();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/list']);
  }));

  it('should display error message on submit failure', fakeAsync(() => {
    const form = component.diveForm;
    form.patchValue({
      ort: 'Bells',
      datum: '2026-06-21'
    });
    diveServiceSpy.saveDive.and.returnValue(throwError(() => new Error('Save error')));

    component.onSubmit();
    expect(component.loading).toBeTrue();
    tick();

    expect(component.loading).toBeFalse();
    expect(component.errorMessage).toBe('Failed to save dive. Please verify inputs and try again.');
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  }));
});
```

---

### 4.3 ListComponent Spec & Templates

#### 4.3.1 `list.component.html`
```html
<div class="list-container">
  <div class="list-header">
    <h2>Dive Logs</h2>
    <button type="button" class="btn btn-primary" routerLink="/upload">+ Log New Dive</button>
  </div>

  <div class="loading-state" *ngIf="loading">
    <div class="spinner"></div>
    <p>Loading dive logs...</p>
  </div>

  <div class="error-alert" *ngIf="errorMessage">
    <p>{{ errorMessage }}</p>
  </div>

  <div class="empty-state" *ngIf="!loading && !errorMessage && dives.length === 0">
    <p>No dive logs recorded yet. Start by uploading a dive log photo!</p>
    <button type="button" class="btn btn-success" routerLink="/upload">Upload First Log</button>
  </div>

  <div class="table-responsive" *ngIf="!loading && !errorMessage && dives.length > 0">
    <table class="dive-table">
      <thead>
        <tr>
          <th>Nr.</th>
          <th>Date</th>
          <th>Location</th>
          <th>Depth</th>
          <th>Duration</th>
          <th>Temp</th>
          <th>Weight</th>
          <th>Visibility</th>
          <th>Current</th>
          <th>Buddy</th>
          <th>Stamps</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let dive of dives">
          <td>{{ dive.tauchgang_nr !== null ? dive.tauchgang_nr : '-' }}</td>
          <td class="whitespace-nowrap">{{ dive.datum }}</td>
          <td>{{ dive.ort }}</td>
          <td>{{ dive.tiefe_m !== null ? dive.tiefe_m + ' m' : '-' }}</td>
          <td>{{ dive.dauer_min !== null ? dive.dauer_min + ' min' : '-' }}</td>
          <td>{{ dive.temperatur_c !== null ? dive.temperatur_c + ' °C' : '-' }}</td>
          <td>{{ dive.gewicht_kg !== null ? dive.gewicht_kg + ' kg' : '-' }}</td>
          <td>{{ dive.sicht || '-' }}</td>
          <td>{{ dive.stroemung || '-' }}</td>
          <td>{{ dive.unterschrift_partner || '-' }}</td>
          <td>
            <div class="stamp-badges" *ngIf="dive.stempel && dive.stempel.length > 0">
              <span class="badge" *ngFor="let stamp of dive.stempel">{{ stamp }}</span>
            </div>
            <span *ngIf="!dive.stempel || dive.stempel.length === 0">-</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

#### 4.3.2 `list.component.css`
```css
.list-container {
  max-width: 1200px;
  margin: 2rem auto;
  padding: 1.5rem;
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid #eee;
  padding-bottom: 1rem;
}
.list-header h2 {
  margin: 0;
  color: #333;
}
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3rem;
}
.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  color: #666;
}
.empty-state p {
  margin-bottom: 1.5rem;
  font-size: 1.1rem;
}
.table-responsive {
  width: 100%;
  overflow-x: auto;
}
.dive-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}
.dive-table th, .dive-table td {
  padding: 0.8rem 1rem;
  border-bottom: 1px solid #eee;
  font-size: 0.95rem;
}
.dive-table th {
  background: #f8f9fa;
  color: #495057;
  font-weight: 600;
}
.dive-table tbody tr:hover {
  background: #f8f9fa;
}
.whitespace-nowrap {
  white-space: nowrap;
}
.stamp-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}
.badge {
  background: #e2f0fe;
  color: #0056b3;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 500;
}
.error-alert {
  padding: 0.75rem 1rem;
  border-radius: 4px;
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
  margin-bottom: 1.5rem;
}
```

#### 4.3.3 `list.component.ts`
```typescript
import { Component, OnInit } from '@angular/core';
import { DiveService, Dive } from '../../services/dive.service';

@Component({
  selector: 'app-list',
  templateUrl: './list.component.html',
  styleUrls: ['./list.component.css']
})
export class ListComponent implements OnInit {
  dives: Dive[] = [];
  loading = false;
  errorMessage: string | null = null;

  constructor(private diveService: DiveService) {}

  ngOnInit(): void {
    this.fetchDives();
  }

  fetchDives(): void {
    this.loading = true;
    this.errorMessage = null;

    this.diveService.getDives().subscribe({
      next: (data) => {
        this.loading = false;
        // Sort dives descending chronologically (by datum), and then by dive number (tauchgang_nr)
        this.dives = data.sort((a, b) => {
          const dateComparison = b.datum.localeCompare(a.datum);
          if (dateComparison !== 0) {
            return dateComparison;
          }
          const nrA = a.tauchgang_nr ?? 0;
          const nrB = b.tauchgang_nr ?? 0;
          return nrB - nrA;
        });
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = 'Failed to load dive logs. Please try again later.';
        console.error(err);
      }
    });
  }
}
```

#### 4.3.4 `list.component.spec.ts`
```typescript
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { ListComponent } from './list.component';
import { DiveService, Dive } from '../../services/dive.service';

describe('ListComponent', () => {
  let component: ListComponent;
  let fixture: ComponentFixture<ListComponent>;
  let diveServiceSpy: jasmine.SpyObj<DiveService>;

  beforeEach(async () => {
    const serviceSpy = jasmine.createSpyObj('DiveService', ['getDives']);

    await TestBed.configureTestingModule({
      declarations: [ListComponent],
      imports: [RouterTestingModule],
      providers: [
        { provide: DiveService, useValue: serviceSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ListComponent);
    component = fixture.componentInstance;
    diveServiceSpy = TestBed.inject(DiveService) as jasmine.SpyObj<DiveService>;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load dives and sort them descending on init', fakeAsync(() => {
    const mockDives: Dive[] = [
      {
        id: 1,
        tauchgang_nr: 1,
        ort: 'Dahab',
        datum: '2026-06-15',
        sicht: null,
        gewicht_kg: null,
        dauer_min: null,
        tiefe_m: null,
        temperatur_c: null,
        stroemung: null,
        unterschrift_partner: null,
        stempel: [],
        created_at: '2026-06-15'
      },
      {
        id: 2,
        tauchgang_nr: 2,
        ort: 'El Fanadir',
        datum: '2026-06-20',
        sicht: null,
        gewicht_kg: null,
        dauer_min: null,
        tiefe_m: null,
        temperatur_c: null,
        stroemung: null,
        unterschrift_partner: null,
        stempel: [],
        created_at: '2026-06-20'
      },
      {
        id: 3,
        tauchgang_nr: 3,
        ort: 'Gota',
        datum: '2026-06-20',
        sicht: null,
        gewicht_kg: null,
        dauer_min: null,
        tiefe_m: null,
        temperatur_c: null,
        stroemung: null,
        unterschrift_partner: null,
        stempel: [],
        created_at: '2026-06-20'
      }
    ];

    diveServiceSpy.getDives.and.returnValue(of(mockDives));

    fixture.detectChanges(); // triggers ngOnInit

    expect(component.loading).toBeTrue();
    tick(); // resolve getDives observable

    expect(component.loading).toBeFalse();
    expect(component.dives.length).toBe(3);

    // Verify sort order: Date descending, then Dive Nr descending
    // Index 0 should be Gota (2026-06-20, nr 3)
    // Index 1 should be El Fanadir (2026-06-20, nr 2)
    // Index 2 should be Dahab (2026-06-15, nr 1)
    expect(component.dives[0].ort).toBe('Gota');
    expect(component.dives[1].ort).toBe('El Fanadir');
    expect(component.dives[2].ort).toBe('Dahab');
  }));

  it('should set error message on load failure', fakeAsync(() => {
    diveServiceSpy.getDives.and.returnValue(throwError(() => new Error('API error')));

    fixture.detectChanges(); // ngOnInit

    tick();

    expect(component.loading).toBeFalse();
    expect(component.dives.length).toBe(0);
    expect(component.errorMessage).toBe('Failed to load dive logs. Please try again later.');
  }));
});
```

## 5. Verification Method

- **Command Line Tests**:
  - Run the test suite:
    `CHROME_BIN=/home/daniel/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome npm run test -- --watch=false --browsers=ChromeHeadless`
  - Ensure all 22 tests pass as compile/sanity baseline. Once the components are written, this command should successfully run and execute the new component tests.
- **Visual Inspections**:
  - Open `frontend/src/app/components/upload/upload.component.html` and verify that the select file button, dropzone element, and preview are correctly linked to TS controller handlers.
  - Open `frontend/src/app/components/verification/verification.component.ts` and inspect form definition validations against backend schema restrictions.
  - Open `frontend/src/app/components/list/list.component.ts` and verify sorting parameters.
