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
