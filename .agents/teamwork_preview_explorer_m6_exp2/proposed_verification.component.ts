import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Router } from '@angular/router';
import { DiveService, DiveDraft } from '../../services/dive.service';

export function calendarDateValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (!value) return null;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(value)) {
      return { invalidFormat: true };
    }
    const parts = value.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);

    if (month < 1 || month > 12) {
      return { invalidMonth: true };
    }
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return { invalidDate: true };
    }
    return null;
  };
}

@Component({
  selector: 'app-verification',
  templateUrl: './verification.component.html',
  styleUrls: ['./verification.component.css']
})
export class VerificationComponent implements OnInit {
  diveForm!: FormGroup;
  stempelList: string[] = [];
  newStamp = '';
  saving = false;
  error: string | null = null;

  constructor(
    private fb: FormBuilder,
    private diveService: DiveService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const draft = this.diveService.getDraftDive();

    this.diveForm = this.fb.group({
      tauchgang_nr: [draft?.tauchgang_nr ?? null, [Validators.min(0), Validators.max(100000), Validators.pattern('^[0-9]*$')]],
      ort: [draft?.ort ?? '', [Validators.required, Validators.maxLength(1000)]],
      datum: [draft?.datum ?? '', [Validators.required, calendarDateValidator()]],
      sicht: [draft?.sicht ?? null, [Validators.maxLength(1000)]],
      gewicht_kg: [draft?.gewicht_kg ?? null, [Validators.min(0), Validators.max(100000)]],
      dauer_min: [draft?.dauer_min ?? null, [Validators.min(0), Validators.max(100000), Validators.pattern('^[0-9]*$')]],
      tiefe_m: [draft?.tiefe_m ?? null, [Validators.min(0), Validators.max(11000)]],
      temperatur_c: [draft?.temperatur_c ?? null, [Validators.min(0), Validators.max(100000), Validators.pattern('^[0-9]*$')]],
      stroemung: [draft?.stroemung ?? null, [Validators.maxLength(1000)]],
      unterschrift_partner: [draft?.unterschrift_partner ?? null, [Validators.maxLength(1000)]]
    });

    if (draft && Array.isArray(draft.stempel)) {
      this.stempelList = [...draft.stempel];
    }
  }

  addStamp(): void {
    if (this.newStamp && this.newStamp.trim() !== '') {
      this.stempelList.push(this.newStamp.trim());
      this.newStamp = '';
    }
  }

  removeStamp(index: number): void {
    this.stempelList.splice(index, 1);
  }

  onSave(): void {
    if (this.diveForm.invalid) {
      this.error = 'Bitte korrigieren Sie die Fehler im Formular.';
      return;
    }

    this.saving = true;
    this.error = null;

    const formVal = this.diveForm.value;
    
    // Coerce numeric fields before saving, matching DiveService specifications
    const payload: DiveDraft = {
      tauchgang_nr: formVal.tauchgang_nr !== '' && formVal.tauchgang_nr !== null ? Number(formVal.tauchgang_nr) : null,
      ort: formVal.ort,
      datum: formVal.datum,
      sicht: formVal.sicht || null,
      gewicht_kg: formVal.gewicht_kg !== '' && formVal.gewicht_kg !== null ? Number(formVal.gewicht_kg) : null,
      dauer_min: formVal.dauer_min !== '' && formVal.dauer_min !== null ? Number(formVal.dauer_min) : null,
      tiefe_m: formVal.tiefe_m !== '' && formVal.tiefe_m !== null ? Number(formVal.tiefe_m) : null,
      temperatur_c: formVal.temperatur_c !== '' && formVal.temperatur_c !== null ? Number(formVal.temperatur_c) : null,
      stroemung: formVal.stroemung || null,
      unterschrift_partner: formVal.unterschrift_partner || null,
      stempel: [...this.stempelList]
    };

    this.diveService.saveDive(payload).subscribe({
      next: () => {
        this.saving = false;
        this.router.navigate(['/list']);
      },
      error: (err) => {
        this.saving = false;
        this.error = err.error?.error || 'Fehler beim Speichern des Tauchgangs. Bitte überprüfen Sie Ihre Eingaben.';
      }
    });
  }
}
