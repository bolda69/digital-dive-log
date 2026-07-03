import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { DiveService, DiveDraft, Dive } from '../../services/dive.service';

@Component({
  selector: 'app-verification',
  templateUrl: './verification.component.html',
  styleUrls: ['./verification.component.css']
})
export class VerificationComponent implements OnInit {
  // --- Edit mode ---
  editMode = false;
  editId: number | null = null;
  loadingEdit = false;

  // --- New dive queue mode ---
  drafts: DiveDraft[] = [];
  currentIndex = 0;
  savedCount = 0;
  skippedInSession = 0;

  // --- Shared state ---
  form!: FormGroup;
  saving = false;
  errorMessage: string | null = null;

  constructor(
    private fb: FormBuilder,
    private diveService: DiveService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');

    if (idParam) {
      // ---- EDIT MODE ----
      this.editMode = true;
      this.editId = parseInt(idParam, 10);
      this.loadingEdit = true;

      this.diveService.getDiveById(this.editId).subscribe({
        next: (dive: Dive) => {
          this.loadingEdit = false;
          this.buildForm(dive);
        },
        error: () => {
          this.loadingEdit = false;
          this.router.navigate(['/list']);
        }
      });
    } else {
      // ---- NEW DIVE QUEUE MODE ----
      this.drafts = this.diveService.getDraftDives();
      if (!this.drafts || this.drafts.length === 0) {
        this.router.navigate(['/upload']);
        return;
      }
      this.buildForm(this.drafts[this.currentIndex]);
    }
  }

  get currentDraft(): DiveDraft {
    return this.drafts[this.currentIndex];
  }

  get totalDives(): number {
    return this.drafts.length;
  }

  get isLast(): boolean {
    return this.currentIndex === this.drafts.length - 1;
  }

  get progressPercent(): number {
    return Math.round((this.currentIndex / this.drafts.length) * 100);
  }

  private buildForm(draft: DiveDraft | Dive): void {
    this.errorMessage = null;
    this.form = this.fb.group({
      tauchgang_nr: [draft.tauchgang_nr],
      ort: [draft.ort, Validators.required],
      datum: [draft.datum, Validators.required],
      tiefe_m: [draft.tiefe_m],
      dauer_min: [draft.dauer_min],
      temperatur_c: [draft.temperatur_c],
      gewicht_kg: [draft.gewicht_kg],
      sicht: [draft.sicht],
      stroemung: [draft.stroemung ?? ''],
      unterschrift_partner: [draft.unterschrift_partner],
      bemerkungen: [draft.bemerkungen],
      stempel: this.fb.array(
        (draft.stempel || []).map(s => this.fb.control(s))
      )
    });
  }

  get stempel(): FormArray {
    return this.form.get('stempel') as FormArray;
  }

  addStempel(): void {
    this.stempel.push(this.fb.control(''));
  }

  removeStempel(index: number): void {
    this.stempel.removeAt(index);
  }

  trackByIndex(index: number): number {
    return index;
  }

  isInvalid(name: string): boolean {
    const ctrl = this.form.get(name);
    return !!(ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched));
  }

  skipCurrent(): void {
    this.skippedInSession++;
    this.advance();
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.errorMessage = null;

    const value = this.form.value;
    const dive: DiveDraft = {
      ...value,
      stempel: (value.stempel as string[]).filter(s => s && s.trim() !== '')
    };

    if (this.editMode && this.editId !== null) {
      // --- UPDATE ---
      this.diveService.updateDive(this.editId, dive).subscribe({
        next: () => {
          this.saving = false;
          this.router.navigate(['/list']);
        },
        error: (err) => {
          this.saving = false;
          this.errorMessage = err.error?.error || `Fehler beim Speichern (${err.status}).`;
        }
      });
    } else {
      // --- CREATE ---
      this.diveService.saveDive(dive).subscribe({
        next: () => {
          this.saving = false;
          this.savedCount++;
          this.advance();
        },
        error: (err) => {
          this.saving = false;
          this.errorMessage = err.error?.error || `Fehler beim Speichern (${err.status}).`;
        }
      });
    }
  }

  private advance(): void {
    if (this.isLast) {
      this.diveService.setDraftDives([]);
      this.router.navigate(['/list'], {
        queryParams: { saved: this.savedCount, skipped: this.skippedInSession }
      });
    } else {
      this.currentIndex++;
      this.buildForm(this.drafts[this.currentIndex]);
    }
  }

  goBack(): void {
    if (this.editMode) {
      this.router.navigate(['/list']);
    } else {
      this.router.navigate(['/upload']);
    }
  }
}
