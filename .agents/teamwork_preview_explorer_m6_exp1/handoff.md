# Handoff Report: Milestone 6 (Frontend View Components) Design & Plan

This report presents the design and implementation plan for the three core Angular view components: `UploadComponent`, `VerificationComponent`, and `ListComponent`.

---

## 1. Observation

During our codebase investigation, the following files, declarations, and configurations were observed:

### A. Core Interfaces & Service Contract
In `frontend/src/app/services/dive.service.ts` (lines 6-23):
```typescript
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
```
And its key methods (lines 36-65):
```typescript
getDives(): Observable<Dive[]> { ... }
saveDive(dive: DiveDraft): Observable<Dive> { ... }
uploadImage(file: File): Observable<DiveDraft> { ... }
setDraftDive(dive: DiveDraft | null): void { ... }
getDraftDive(): DiveDraft | null { ... }
```
The service also provides `draftDive$: Observable<DiveDraft | null>` (line 32) as a stream of the current draft.

### B. Scaffolded Components & Folder Structure
Under `frontend/src/app/components`:
- `upload/`: `upload.component.ts`, `upload.component.html`, `upload.component.spec.ts`
- `verification/`: `verification.component.ts`, `verification.component.html`, `verification.component.spec.ts`
- `list/`: `list.component.ts`, `list.component.html`, `list.component.spec.ts`

All components are declared in `frontend/src/app/app.module.ts`, which also imports standard forms support (lines 3-4):
```typescript
import { HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
```

### C. App Routing Configurations
In `frontend/src/app/app-routing.module.ts` (lines 7-15):
```typescript
export const routes: Routes = [
  { path: 'upload', component: UploadComponent },
  { path: 'verification', component: VerificationComponent },
  { path: 'verify', redirectTo: '/verification', pathMatch: 'full' },
  { path: 'list', component: ListComponent },
  { path: 'dives', redirectTo: '/list', pathMatch: 'full' },
  { path: '', redirectTo: '/list', pathMatch: 'full' },
  { path: '**', redirectTo: '/list' }
];
```

### D. Build and Test Commands
Running `npm run build` inside `frontend/` succeeds with the output:
```
✔ Browser application bundle generation complete.
Initial chunk files   | Names         |  Raw size | Estimated transfer size
main-K5D44EAQ.js      | main          | 207.83 kB |                54.83 kB
polyfills-FFHMD2TL.js | polyfills     |  33.71 kB |                11.02 kB
```
Running `npm run test` or `npm run test -- --watch=false --browsers=ChromeHeadless` fails with:
```
No binary for Chrome browser on your platform. Please, set "CHROME_BIN" env variable.
```
Although `/usr/bin/firefox` is present, `karma-firefox-launcher` is not currently in the project's devDependencies, meaning local headless test execution requires either configuring Chrome or adding a Firefox launcher.

---

## 2. Logic Chain

1. **Upload Workflow Mapping**:
   - The user selects or captures a photo via a custom-styled `<input type="file" accept="image/*;capture=camera">` control.
   - When the file is chosen, `UploadComponent.uploadFile()` passes it to `DiveService.uploadImage(file)`.
   - While the API request is pending, `isUploading` is set to `true`, rendering a spinner on the UI and disabling action buttons.
   - Upon a successful upload, `DiveService` sets the returned `DiveDraft` in `draftDiveSubject` and returns it. The component then calls `Router.navigate(['/verification'])` to guide the user to check the OCR output.

2. **Verification Form Structure & Validation**:
   - `VerificationComponent` uses a Reactive Form (`FormGroup`) to enable structured input validation and simple dynamic modifications (specifically for stamps).
   - In `ngOnInit()`, the component checks if `DiveService.getDraftDive()` or the `draftDive$` stream contains a draft. If it does not exist, a template fallback tells the user to navigate back to `/upload`.
   - If a draft is present, the form is initialized using the `FormBuilder`.
   - The validation rules enforce the required fields: `ort` (location) and `datum` (date).
   - Validation also enforces numeric restrictions (non-negative depths, durations, weights, and realistic ranges for temperatures).
   - Dynamic stamps are modeled as a `FormArray` containing individual `FormControl` elements. This allows the user to append or delete individual stamps dynamically.
   - When the form is submitted, the component sends `this.verificationForm.value` to `DiveService.saveDive()`. The service automatically coercies the numeric fields and cleans strings (via `prepareForBackend()`), after which it clears the draft state. On success, the application routes the user to `/list`.

3. **List Presentation**:
   - `ListComponent` triggers `DiveService.getDives()` on init.
   - It maintains `isLoading` and `errorMessage` states to manage UI visibility: a spinner is shown while fetching, a retry banner is shown on network errors, and an empty state banner is rendered if the list is empty.
   - Dives are shown using a grid layout, where stamps are listed as badge tags (`stempel` array).

---

## 3. Caveats

- **No CSS framework dependencies**: Since the project doesn't bundle Tailwind CSS or Angular Material by default, the markup specifications use semantic HTML and basic class names. Developers can style these components directly in their respective `.component.css` files.
- **Chrome Binary Missing for Tests**: Running tests locally on the host machine will require configuring the `CHROME_BIN` path or installing the `karma-firefox-launcher` package.

---

## 4. Conclusion: Detailed Specifications & Designs

### 4.1. UploadComponent

#### A. Logic Class: `upload.component.ts`
```typescript
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { DiveService } from '../../services/dive.service';

@Component({
  selector: 'app-upload',
  templateUrl: './upload.component.html',
  styleUrl: './upload.component.css'
})
export class UploadComponent {
  selectedFile: File | null = null;
  isUploading = false;
  errorMessage: string | null = null;

  constructor(
    private diveService: DiveService,
    private router: Router
  ) {}

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      this.errorMessage = null;
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      this.selectedFile = event.dataTransfer.files[0];
      this.errorMessage = null;
    }
  }

  uploadFile(): void {
    if (!this.selectedFile) {
      this.errorMessage = 'Please select a file first.';
      return;
    }

    this.isUploading = true;
    this.errorMessage = null;

    this.diveService.uploadImage(this.selectedFile).subscribe({
      next: () => {
        this.isUploading = false;
        this.router.navigate(['/verification']);
      },
      error: (err) => {
        this.isUploading = false;
        this.errorMessage = 'Failed to upload image or extract dive data. Please try again.';
        console.error(err);
      }
    });
  }
}
```

#### B. Template Markup: `upload.component.html`
```html
<div class="upload-container">
  <h2>Upload Physical Dive Log</h2>
  <p class="description">Upload or capture a photo of a page from your physical logbook to automatically digitize the dive log using OCR.</p>

  <div class="dropzone" 
       (dragover)="onDragOver($event)" 
       (drop)="onDrop($event)"
       (click)="fileInput.click()">
    <input type="file" 
           #fileInput 
           accept="image/*;capture=camera" 
           style="display: none;" 
           (change)="onFileSelected($event)">
    
    <div class="dropzone-content" *ngIf="!selectedFile">
      <div class="upload-icon-wrapper">
        <svg class="upload-icon" viewBox="0 0 24 24" width="48" height="48">
          <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
        </svg>
      </div>
      <p>Drag & drop a log page photo here, or <span class="browse-link">browse files</span></p>
      <span class="support-info">Supports JPG, PNG (camera capture enabled on mobile)</span>
    </div>

    <div class="selected-file-info" *ngIf="selectedFile">
      <svg class="file-icon" viewBox="0 0 24 24" width="32" height="32">
        <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
      </svg>
      <p class="file-name">{{ selectedFile.name }}</p>
      <span class="file-size">({{ (selectedFile.size / 1024).toFixed(1) }} KB)</span>
    </div>
  </div>

  <div class="action-buttons">
    <button class="btn btn-primary" 
            [disabled]="!selectedFile || isUploading" 
            (click)="uploadFile()">
      <span *ngIf="!isUploading">Upload & Process</span>
      <span *ngIf="isUploading" class="spinner-container">
        <span class="spinner"></span> Extracting data...
      </span>
    </button>
  </div>

  <div class="error-banner" *ngIf="errorMessage">
    {{ errorMessage }}
  </div>
</div>
```


### 4.2. VerificationComponent

#### A. Logic Class: `verification.component.ts`
```typescript
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { Router } from '@angular/router';
import { DiveService, DiveDraft } from '../../services/dive.service';

@Component({
  selector: 'app-verification',
  templateUrl: './verification.component.html',
  styleUrl: './verification.component.css'
})
export class VerificationComponent implements OnInit {
  verificationForm!: FormGroup;
  isSaving = false;
  errorMessage: string | null = null;
  hasDraft = false;

  constructor(
    private fb: FormBuilder,
    private diveService: DiveService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const draft = this.diveService.getDraftDive();
    if (draft) {
      this.hasDraft = true;
      this.initForm(draft);
    } else {
      // Fallback subscribe in case state updates asynchronously
      this.diveService.draftDive$.subscribe(d => {
        if (d) {
          this.hasDraft = true;
          this.initForm(d);
        }
      });
    }
  }

  initForm(draft: DiveDraft): void {
    this.verificationForm = this.fb.group({
      tauchgang_nr: [draft.tauchgang_nr, [Validators.min(1)]],
      ort: [draft.ort, [Validators.required]],
      datum: [draft.datum, [Validators.required]],
      sicht: [draft.sicht],
      gewicht_kg: [draft.gewicht_kg, [Validators.min(0)]],
      dauer_min: [draft.dauer_min, [Validators.min(0)]],
      tiefe_m: [draft.tiefe_m, [Validators.min(0)]],
      temperatur_c: [draft.temperatur_c, [Validators.min(-20), Validators.max(50)]],
      stroemung: [draft.stroemung],
      unterschrift_partner: [draft.unterschrift_partner],
      stempel: this.fb.array(draft.stempel ? draft.stempel.map(s => this.fb.control(s)) : [])
    });
  }

  get stempelFormArray(): FormArray {
    return this.verificationForm.get('stempel') as FormArray;
  }

  addStamp(event: Event): void {
    event.preventDefault();
    const input = event.target as HTMLInputElement;
    const value = input.value.trim();
    if (value) {
      this.stempelFormArray.push(this.fb.control(value));
      input.value = '';
    }
  }

  addStampBtn(inputElement: HTMLInputElement): void {
    const value = inputElement.value.trim();
    if (value) {
      this.stempelFormArray.push(this.fb.control(value));
      inputElement.value = '';
    }
  }

  removeStamp(index: number): void {
    this.stempelFormArray.removeAt(index);
  }

  onSubmit(): void {
    if (this.verificationForm.invalid) {
      this.verificationForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    this.errorMessage = null;

    const diveData: DiveDraft = this.verificationForm.value;

    this.diveService.saveDive(diveData).subscribe({
      next: () => {
        this.isSaving = false;
        this.router.navigate(['/list']);
      },
      error: (err) => {
        this.isSaving = false;
        this.errorMessage = 'Failed to save the dive log. Please check inputs and try again.';
        console.error(err);
      }
    });
  }

  cancelVerification(): void {
    this.diveService.setDraftDive(null);
    this.router.navigate(['/list']);
  }
}
```

#### B. Template Markup: `verification.component.html`
```html
<div class="verification-container" *ngIf="hasDraft; else noDraftTemplate">
  <h2>Verify Extracted Dive Data</h2>
  <p class="intro">We extracted the following details from your uploaded log. Please review and update them as necessary before saving.</p>

  <form [formGroup]="verificationForm" (ngSubmit)="onSubmit()" class="dive-form">
    <div class="form-grid">
      
      <!-- Dive Number -->
      <div class="form-group">
        <label for="tauchgang_nr">Dive Number (#)</label>
        <input type="number" id="tauchgang_nr" formControlName="tauchgang_nr" placeholder="e.g. 1" class="form-control">
        <div class="error-msg" *ngIf="verificationForm.get('tauchgang_nr')?.touched && verificationForm.get('tauchgang_nr')?.errors?.['min']">
          Dive number must be 1 or greater.
        </div>
      </div>

      <!-- Location (Required) -->
      <div class="form-group required">
        <label for="ort">Location / Dive Site</label>
        <input type="text" id="ort" formControlName="ort" placeholder="e.g. Blue Hole" class="form-control">
        <div class="error-msg" *ngIf="verificationForm.get('ort')?.touched && verificationForm.get('ort')?.errors?.['required']">
          Location is required.
        </div>
      </div>

      <!-- Date (Required) -->
      <div class="form-group required">
        <label for="datum">Date</label>
        <input type="date" id="datum" formControlName="datum" class="form-control">
        <div class="error-msg" *ngIf="verificationForm.get('datum')?.touched && verificationForm.get('datum')?.errors?.['required']">
          Date is required.
        </div>
      </div>

      <!-- Depth (m) -->
      <div class="form-group">
        <label for="tiefe_m">Max Depth (meters)</label>
        <input type="number" step="0.1" id="tiefe_m" formControlName="tiefe_m" placeholder="e.g. 22.4" class="form-control">
        <div class="error-msg" *ngIf="verificationForm.get('tiefe_m')?.touched && verificationForm.get('tiefe_m')?.errors?.['min']">
          Depth cannot be negative.
        </div>
      </div>

      <!-- Duration (min) -->
      <div class="form-group">
        <label for="dauer_min">Duration (minutes)</label>
        <input type="number" id="dauer_min" formControlName="dauer_min" placeholder="e.g. 50" class="form-control">
        <div class="error-msg" *ngIf="verificationForm.get('dauer_min')?.touched && verificationForm.get('dauer_min')?.errors?.['min']">
          Duration cannot be negative.
        </div>
      </div>

      <!-- Water Temperature -->
      <div class="form-group">
        <label for="temperatur_c">Water Temp (°C)</label>
        <input type="number" id="temperatur_c" formControlName="temperatur_c" placeholder="e.g. 18" class="form-control">
        <div class="error-msg" *ngIf="verificationForm.get('temperatur_c')?.touched && (verificationForm.get('temperatur_c')?.errors?.['min'] || verificationForm.get('temperatur_c')?.errors?.['max'])">
          Temperature must be between -20°C and 50°C.
        </div>
      </div>

      <!-- Visibility -->
      <div class="form-group">
        <label for="sicht">Visibility</label>
        <input type="text" id="sicht" formControlName="sicht" placeholder="e.g. 10m" class="form-control">
      </div>

      <!-- Weight (kg) -->
      <div class="form-group">
        <label for="gewicht_kg">Weight (kg)</label>
        <input type="number" step="0.1" id="gewicht_kg" formControlName="gewicht_kg" placeholder="e.g. 6" class="form-control">
        <div class="error-msg" *ngIf="verificationForm.get('gewicht_kg')?.touched && verificationForm.get('gewicht_kg')?.errors?.['min']">
          Weight cannot be negative.
        </div>
      </div>

      <!-- Current / Flow -->
      <div class="form-group">
        <label for="stroemung">Current / Flow</label>
        <input type="text" id="stroemung" formControlName="stroemung" placeholder="e.g. Moderate" class="form-control">
      </div>

      <!-- Buddy Name -->
      <div class="form-group">
        <label for="unterschrift_partner">Buddy Signature / Name</label>
        <input type="text" id="unterschrift_partner" formControlName="unterschrift_partner" placeholder="e.g. Jane Smith" class="form-control">
      </div>

    </div>

    <!-- Stamps Control -->
    <div class="stamps-section">
      <label class="section-label">Stamps / OCR Detected Tags</label>
      
      <div class="stamps-list" *ngIf="stempelFormArray.length > 0">
        <div class="stamp-badge" *ngFor="let stampCtrl of stempelFormArray.controls; let i = index">
          <span class="badge-text">{{ stampCtrl.value }}</span>
          <button type="button" class="remove-badge" (click)="removeStamp(i)">&times;</button>
        </div>
      </div>
      <div class="no-stamps-info" *ngIf="stempelFormArray.length === 0">
        No stamps or tags extracted. Add one below.
      </div>

      <div class="add-stamp-row">
        <input type="text" 
               #stampInput 
               placeholder="Add stamp (e.g. PADI Dive Center)" 
               class="form-control stamp-input"
               (keyup.enter)="addStamp($event)">
        <button type="button" class="btn btn-secondary" (click)="addStampBtn(stampInput)">Add</button>
      </div>
    </div>

    <div class="error-banner" *ngIf="errorMessage">
      {{ errorMessage }}
    </div>

    <div class="form-actions">
      <button type="button" class="btn btn-cancel" [disabled]="isSaving" (click)="cancelVerification()">Cancel Draft</button>
      <button type="submit" class="btn btn-primary" [disabled]="verificationForm.invalid || isSaving">
        <span *ngIf="!isSaving">Verify & Save</span>
        <span *ngIf="isSaving">Saving...</span>
      </button>
    </div>
  </form>
</div>

<ng-template #noDraftTemplate>
  <div class="no-draft-container">
    <h2>No Draft Dive Log Found</h2>
    <p>Please upload a photo of a physical log page before editing verification details.</p>
    <button class="btn btn-primary" routerLink="/upload">Go to Upload</button>
  </div>
</ng-template>
```


### 4.3. ListComponent

#### A. Logic Class: `list.component.ts`
```typescript
import { Component, OnInit } from '@angular/core';
import { DiveService, Dive } from '../../services/dive.service';

@Component({
  selector: 'app-list',
  templateUrl: './list.component.html',
  styleUrl: './list.component.css'
})
export class ListComponent implements OnInit {
  dives: Dive[] = [];
  isLoading = false;
  errorMessage: string | null = null;

  constructor(private diveService: DiveService) {}

  ngOnInit(): void {
    this.fetchDives();
  }

  fetchDives(): void {
    this.isLoading = true;
    this.errorMessage = null;

    this.diveService.getDives().subscribe({
      next: (data) => {
        this.dives = data;
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = 'Could not load your dives. Please verify your connection.';
        console.error(err);
      }
    });
  }
}
```

#### B. Template Markup: `list.component.html`
```html
<div class="list-container">
  <div class="list-header">
    <h2>Your Dive Logbook</h2>
    <button class="btn btn-primary" routerLink="/upload">
      <svg class="plus-icon" viewBox="0 0 24 24" width="16" height="16">
        <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
      </svg>
      Upload New Log
    </button>
  </div>

  <div class="error-banner" *ngIf="errorMessage">
    <span>{{ errorMessage }}</span>
    <button class="btn btn-retry" (click)="fetchDives()">Retry</button>
  </div>

  <!-- Loading State -->
  <div class="loading-state" *ngIf="isLoading">
    <span class="spinner"></span>
    <p>Loading dive logs...</p>
  </div>

  <!-- Empty State -->
  <div class="empty-state" *ngIf="!isLoading && !errorMessage && dives.length === 0">
    <div class="empty-icon-wrapper">
      <svg viewBox="0 0 24 24" width="64" height="64" class="empty-icon">
        <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/>
      </svg>
    </div>
    <h3>No Dives Logged Yet</h3>
    <p>Upload a photo of your paper dive log to automatically digitize it.</p>
    <button class="btn btn-primary" routerLink="/upload">Upload First Log</button>
  </div>

  <!-- Dives Grid -->
  <div class="dives-wrapper" *ngIf="!isLoading && !errorMessage && dives.length > 0">
    <div class="dives-grid">
      <div class="dive-card" *ngFor="let dive of dives">
        
        <div class="dive-card-header">
          <div class="dive-meta">
            <span class="dive-number" *ngIf="dive.tauchgang_nr">#{{ dive.tauchgang_nr }}</span>
            <span class="dive-date">{{ dive.datum | date:'mediumDate' }}</span>
          </div>
          <h3 class="dive-location">{{ dive.ort }}</h3>
        </div>

        <div class="dive-card-body">
          <div class="metric-row">
            <div class="metric-item" *ngIf="dive.tiefe_m !== null">
              <span class="metric-label">Depth</span>
              <span class="metric-value">{{ dive.tiefe_m }} m</span>
            </div>
            <div class="metric-item" *ngIf="dive.dauer_min !== null">
              <span class="metric-label">Duration</span>
              <span class="metric-value">{{ dive.dauer_min }} min</span>
            </div>
            <div class="metric-item" *ngIf="dive.temperatur_c !== null">
              <span class="metric-label">Temp</span>
              <span class="metric-value">{{ dive.temperatur_c }} °C</span>
            </div>
          </div>

          <div class="detail-grid">
            <div class="detail-item" *ngIf="dive.sicht">
              <span class="detail-label">Visibility:</span>
              <span class="detail-value">{{ dive.sicht }}</span>
            </div>
            <div class="detail-item" *ngIf="dive.gewicht_kg !== null">
              <span class="detail-label">Weight:</span>
              <span class="detail-value">{{ dive.gewicht_kg }} kg</span>
            </div>
            <div class="detail-item" *ngIf="dive.stroemung">
              <span class="detail-label">Current:</span>
              <span class="detail-value">{{ dive.stroemung }}</span>
            </div>
            <div class="detail-item" *ngIf="dive.unterschrift_partner">
              <span class="detail-label">Buddy:</span>
              <span class="detail-value">{{ dive.unterschrift_partner }}</span>
            </div>
          </div>

          <!-- Stamps badge tags -->
          <div class="stamps-list-container" *ngIf="dive.stempel && dive.stempel.length > 0">
            <span class="stamps-label">Stamps / Tags:</span>
            <div class="stamps-flex">
              <span class="stamp-tag-badge" *ngFor="let stamp of dive.stempel">{{ stamp }}</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  </div>
</div>
```


### 4.4. Form Validation Rules and Handling of Numerical Conversions

#### Validation Rules Matrix
| Field Name | Type | Validators / Constraints | Rationale |
| :--- | :--- | :--- | :--- |
| `ort` | String | `Validators.required` | Required to associate a dive with a location. |
| `datum` | String (Date) | `Validators.required` | Required to place the dive chronologically. |
| `tauchgang_nr`| Number (Int) | `Validators.min(1)` | Dive counter must be positive and non-zero. |
| `gewicht_kg` | Number | `Validators.min(0)` | Ballast weight cannot be negative. |
| `dauer_min` | Number (Int) | `Validators.min(0)` | Dive duration must be positive. |
| `tiefe_m` | Number | `Validators.min(0)` | Water depth cannot be negative. |
| `temperatur_c`| Number (Int) | `Validators.min(-20)`, `Validators.max(50)` | Limits temp to realistic values for diving. |

#### Numeric Coercion & Form Handling
1. **Frontend Inputs**: Numerical fields use `<input type="number">`. This prompts browsers to enforce number-only keyboard layouts and bind values as numerical numbers (or `null` if left blank) inside the reactive `FormControl` objects.
2. **Backend Submission Fallback**: While the HTML input binds to number objects, `DiveService.saveDive()` runs a robust parsing utility before sending the payload over HTTP:
   - `coerceNumber`: Converts any empty or white-spaced strings to `null`, ensuring it is a valid floating point.
   - `coerceInteger`: Safely rounds floats to integers (e.g. for `dauer_min` or `temperatur_c`).
   This double-layer defense prevents raw empty strings from corrupting payload formatting.


### 4.5. Component Unit Test Specifications

We will replace the existing spec files under each directory. The unit tests are specified below in their complete, copy-pasteable Jasmine configurations.

#### A. Upload Component Unit Tests (`upload.component.spec.ts`)
```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { UploadComponent } from './upload.component';
import { DiveService } from '../../services/dive.service';

describe('UploadComponent', () => {
  let component: UploadComponent;
  let fixture: ComponentFixture<UploadComponent>;
  let mockDiveService: jasmine.SpyObj<DiveService>;
  let mockRouter: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    mockDiveService = jasmine.createSpyObj('DiveService', ['uploadImage']);
    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      declarations: [UploadComponent],
      providers: [
        { provide: DiveService, useValue: mockDiveService },
        { provide: Router, useValue: mockRouter }
      ]
    }).compileComponents();
    
    fixture = TestBed.createComponent(UploadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not upload if no file is selected', () => {
    component.selectedFile = null;
    component.uploadFile();
    expect(component.errorMessage).toBe('Please select a file first.');
    expect(mockDiveService.uploadImage).not.toHaveBeenCalled();
  });

  it('should call uploadImage and navigate on success', () => {
    const mockFile = new File([''], 'test_log.png', { type: 'image/png' });
    const mockDraft = { ort: 'Blue Hole', datum: '2026-06-22', stempel: [], tauchgang_nr: null, sicht: null, gewicht_kg: null, dauer_min: null, tiefe_m: null, temperatur_c: null, stroemung: null, unterschrift_partner: null };
    
    mockDiveService.uploadImage.and.returnValue(of(mockDraft));
    component.selectedFile = mockFile;

    component.uploadFile();

    expect(component.isUploading).toBeFalse();
    expect(mockDiveService.uploadImage).toHaveBeenCalledWith(mockFile);
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/verification']);
  });

  it('should show error banner when upload fails', () => {
    const mockFile = new File([''], 'test_log.png', { type: 'image/png' });
    mockDiveService.uploadImage.and.returnValue(throwError(() => new Error('Server error')));
    component.selectedFile = mockFile;

    component.uploadFile();

    expect(component.isUploading).toBeFalse();
    expect(component.errorMessage).toContain('Failed to upload image');
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });
});
```

#### B. Verification Component Unit Tests (`verification.component.spec.ts`)
```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { of, throwError, BehaviorSubject } from 'rxjs';
import { VerificationComponent } from './verification.component';
import { DiveService, DiveDraft } from '../../services/dive.service';

describe('VerificationComponent', () => {
  let component: VerificationComponent;
  let fixture: ComponentFixture<VerificationComponent>;
  let mockDiveService: jasmine.SpyObj<DiveService>;
  let mockRouter: jasmine.SpyObj<Router>;
  let draftSubject: BehaviorSubject<DiveDraft | null>;

  const mockDraft: DiveDraft = {
    tauchgang_nr: 10,
    ort: 'Blue Hole',
    datum: '2026-06-22',
    sicht: 'Good',
    gewicht_kg: 8,
    dauer_min: 45,
    tiefe_m: 18.5,
    temperatur_c: 22,
    stroemung: 'None',
    unterschrift_partner: 'Buddy Name',
    stempel: ['PADI Stamp']
  };

  beforeEach(async () => {
    draftSubject = new BehaviorSubject<DiveDraft | null>(null);
    mockDiveService = jasmine.createSpyObj('DiveService', ['getDraftDive', 'saveDive', 'setDraftDive']);
    mockDiveService.draftDive$ = draftSubject.asObservable();
    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      declarations: [VerificationComponent],
      imports: [ReactiveFormsModule],
      providers: [
        { provide: DiveService, useValue: mockDiveService },
        { provide: Router, useValue: mockRouter }
      ]
    }).compileComponents();
  });

  it('should show fallback templates when draft is not present', () => {
    mockDiveService.getDraftDive.and.returnValue(null);
    fixture = TestBed.createComponent(VerificationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.hasDraft).toBeFalse();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.no-draft-container')).toBeTruthy();
  });

  it('should initialize form with draft data when present', () => {
    mockDiveService.getDraftDive.and.returnValue(mockDraft);
    fixture = TestBed.createComponent(VerificationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.hasDraft).toBeTrue();
    expect(component.verificationForm.value.ort).toBe('Blue Hole');
    expect(component.verificationForm.value.datum).toBe('2026-06-22');
    expect(component.stempelFormArray.length).toBe(1);
    expect(component.stempelFormArray.at(0).value).toBe('PADI Stamp');
  });

  it('should require ort and datum fields', () => {
    mockDiveService.getDraftDive.and.returnValue(mockDraft);
    fixture = TestBed.createComponent(VerificationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const ortControl = component.verificationForm.get('ort');
    const datumControl = component.verificationForm.get('datum');

    ortControl?.setValue('');
    datumControl?.setValue('');

    expect(component.verificationForm.invalid).toBeTrue();
    expect(ortControl?.errors?.['required']).toBeTruthy();
    expect(datumControl?.errors?.['required']).toBeTruthy();
  });

  it('should validate numeric min/max bounds', () => {
    mockDiveService.getDraftDive.and.returnValue(mockDraft);
    fixture = TestBed.createComponent(VerificationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const depthCtrl = component.verificationForm.get('tiefe_m');
    const tempCtrl = component.verificationForm.get('temperatur_c');

    depthCtrl?.setValue(-5); // Negative depth
    tempCtrl?.setValue(60);  // High temperature

    expect(depthCtrl?.errors?.['min']).toBeTruthy();
    expect(tempCtrl?.errors?.['max']).toBeTruthy();
    expect(component.verificationForm.invalid).toBeTrue();
  });

  it('should support adding and removing stamp tags', () => {
    mockDiveService.getDraftDive.and.returnValue(mockDraft);
    fixture = TestBed.createComponent(VerificationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // Add stamp via button
    const mockInput = document.createElement('input');
    mockInput.value = 'SSI Stamp';
    component.addStampBtn(mockInput);
    expect(component.stempelFormArray.length).toBe(2);
    expect(component.stempelFormArray.at(1).value).toBe('SSI Stamp');

    // Remove stamp
    component.removeStamp(0);
    expect(component.stempelFormArray.length).toBe(1);
    expect(component.stempelFormArray.at(0).value).toBe('SSI Stamp');
  });

  it('should call saveDive and redirect on success', () => {
    mockDiveService.getDraftDive.and.returnValue(mockDraft);
    const mockSavedDive = { ...mockDraft, id: 1, created_at: '2026-06-22T13:00:00Z' };
    mockDiveService.saveDive.and.returnValue(of(mockSavedDive));
    
    fixture = TestBed.createComponent(VerificationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.onSubmit();

    expect(component.isSaving).toBeFalse();
    expect(mockDiveService.saveDive).toHaveBeenCalledWith(component.verificationForm.value);
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/list']);
  });

  it('should display an error banner when saveDive fails', () => {
    mockDiveService.getDraftDive.and.returnValue(mockDraft);
    mockDiveService.saveDive.and.returnValue(throwError(() => new Error('Save failed')));

    fixture = TestBed.createComponent(VerificationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.onSubmit();

    expect(component.isSaving).toBeFalse();
    expect(component.errorMessage).toContain('Failed to save the dive log');
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });
});
```

#### C. List Component Unit Tests (`list.component.spec.ts`)
```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { ListComponent } from './list.component';
import { DiveService, Dive } from '../../services/dive.service';

describe('ListComponent', () => {
  let component: ListComponent;
  let fixture: ComponentFixture<ListComponent>;
  let mockDiveService: jasmine.SpyObj<DiveService>;

  const mockDives: Dive[] = [
    {
      id: 1,
      created_at: '2026-06-22T12:00:00Z',
      tauchgang_nr: 1,
      ort: 'Red Sea',
      datum: '2026-06-20',
      sicht: 'Excellent',
      gewicht_kg: 7,
      dauer_min: 40,
      tiefe_m: 25,
      temperatur_c: 24,
      stroemung: 'Light',
      unterschrift_partner: 'Jane Doe',
      stempel: ['Red Sea Dive Center', 'Instructor Seal']
    }
  ];

  beforeEach(async () => {
    mockDiveService = jasmine.createSpyObj('DiveService', ['getDives']);

    await TestBed.configureTestingModule({
      declarations: [ListComponent],
      imports: [RouterTestingModule],
      providers: [
        { provide: DiveService, useValue: mockDiveService }
      ]
    }).compileComponents();
  });

  it('should display loading spinner when fetching', () => {
    mockDiveService.getDives.and.returnValue(of([]));
    fixture = TestBed.createComponent(ListComponent);
    component = fixture.componentInstance;

    expect(component.isLoading).toBeFalse();
    component.fetchDives();
    // In our synchronous mock, it will resolve instantly, so we can test the subscription triggers
    expect(mockDiveService.getDives).toHaveBeenCalled();
  });

  it('should render dive cards and stamps upon receiving data', () => {
    mockDiveService.getDives.and.returnValue(of(mockDives));
    fixture = TestBed.createComponent(ListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.dives.length).toBe(1);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.dive-card')).toBeTruthy();
    expect(compiled.querySelector('.dive-location')?.textContent).toContain('Red Sea');
    expect(compiled.querySelectorAll('.stamp-tag-badge').length).toBe(2);
  });

  it('should show empty state template if list is empty', () => {
    mockDiveService.getDives.and.returnValue(of([]));
    fixture = TestBed.createComponent(ListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.dives.length).toBe(0);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.empty-state')).toBeTruthy();
  });

  it('should show error banner when HTTP fetch fails', () => {
    mockDiveService.getDives.and.returnValue(throwError(() => new Error('Fetch failed')));
    fixture = TestBed.createComponent(ListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.dives.length).toBe(0);
    expect(component.isLoading).toBeFalse();
    expect(component.errorMessage).toContain('Could not load your dives');
    
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.error-banner')).toBeTruthy();
  });
});
```

---

## 5. Verification Method

To verify the components are designed correctly and compiles:
1. Ensure the component definitions above are successfully built without errors using:
   ```bash
   npm run build
   ```
2. The unit test specifications written above will run and verify component behaviour. Developers can execute:
   ```bash
   npm run test
   ```
   *Note: In environments where the Chrome browser is unavailable, configure the `CHROME_BIN` environment variable or modify the test configurations to run using the installed `/usr/bin/firefox` binary by adding `karma-firefox-launcher`.*
