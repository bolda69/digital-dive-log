import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject, throwError, defer } from 'rxjs';
import { VerificationComponent } from './verification.component';
import { DiveService, DiveDraft } from '../../services/dive.service';

describe('VerificationComponent', () => {
  let component: VerificationComponent;
  let fixture: ComponentFixture<VerificationComponent>;
  let diveServiceSpy: jasmine.SpyObj<DiveService>;
  let router: Router;
  let draftDiveSubject: BehaviorSubject<DiveDraft | null>;

  beforeEach(async () => {
    draftDiveSubject = new BehaviorSubject<DiveDraft | null>(null);
    const serviceSpy = jasmine.createSpyObj('DiveService', ['saveDive']);
    serviceSpy.draftDive$ = draftDiveSubject.asObservable();
    serviceSpy.saveDive.and.returnValue(defer(() => Promise.resolve({
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
    })));

    await TestBed.configureTestingModule({
      declarations: [VerificationComponent],
      imports: [ReactiveFormsModule, FormsModule, RouterTestingModule],
      providers: [
        { provide: DiveService, useValue: serviceSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(VerificationComponent);
    component = fixture.componentInstance;
    diveServiceSpy = TestBed.inject(DiveService) as jasmine.SpyObj<DiveService>;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate');
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
    expect(router.navigate).toHaveBeenCalledWith(['/list']);
  }));

  it('should display error message on submit failure', fakeAsync(() => {
    const form = component.diveForm;
    form.patchValue({
      ort: 'Bells',
      datum: '2026-06-21'
    });
    diveServiceSpy.saveDive.and.returnValue(defer(() => Promise.reject(new Error('Save error'))));

    component.onSubmit();
    expect(component.loading).toBeTrue();
    tick();

    expect(component.loading).toBeFalse();
    expect(component.errorMessage).toBe('Failed to save dive. Please verify inputs and try again.');
    expect(router.navigate).not.toHaveBeenCalled();
  }));
});
