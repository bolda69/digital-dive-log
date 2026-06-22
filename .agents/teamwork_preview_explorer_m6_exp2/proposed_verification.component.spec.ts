import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { VerificationComponent, calendarDateValidator } from './verification.component';
import { DiveService } from '../../services/dive.service';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { ReactiveFormsModule, FormsModule, FormControl } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('VerificationComponent', () => {
  let component: VerificationComponent;
  let fixture: ComponentFixture<VerificationComponent>;
  let diveServiceSpy: jasmine.SpyObj<DiveService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    const dSpy = jasmine.createSpyObj('DiveService', ['getDraftDive', 'saveDive']);
    const rSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      declarations: [ VerificationComponent ],
      imports: [ RouterTestingModule, HttpClientTestingModule, ReactiveFormsModule, FormsModule ],
      providers: [
        { provide: DiveService, useValue: dSpy },
        { provide: Router, useValue: rSpy }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VerificationComponent);
    component = fixture.componentInstance;
    diveServiceSpy = TestBed.inject(DiveService) as jasmine.SpyObj<DiveService>;
    routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
  });

  it('should initialize form with empty values if no draft is present', () => {
    diveServiceSpy.getDraftDive.and.returnValue(null);
    fixture.detectChanges();

    expect(component.diveForm).toBeDefined();
    expect(component.diveForm.get('ort')?.value).toBe('');
    expect(component.diveForm.get('datum')?.value).toBe('');
    expect(component.stempelList).toEqual([]);
  });

  it('should initialize form with draft values if present', () => {
    const draftMock = {
      tauchgang_nr: 15,
      ort: 'El Quseir',
      datum: '2026-06-22',
      sicht: '15m',
      gewicht_kg: 9.0,
      dauer_min: 52,
      tiefe_m: 22.4,
      temperatur_c: 25,
      stroemung: 'strong',
      unterschrift_partner: 'Jane Doe',
      stempel: ['Red Sea Divers']
    };
    diveServiceSpy.getDraftDive.and.returnValue(draftMock);
    fixture.detectChanges();

    expect(component.diveForm.get('tauchgang_nr')?.value).toBe(15);
    expect(component.diveForm.get('ort')?.value).toBe('El Quseir');
    expect(component.diveForm.get('datum')?.value).toBe('2026-06-22');
    expect(component.stempelList).toEqual(['Red Sea Divers']);
  });

  it('should validate required fields', () => {
    diveServiceSpy.getDraftDive.and.returnValue(null);
    fixture.detectChanges();

    const ortControl = component.diveForm.get('ort');
    const datumControl = component.diveForm.get('datum');

    ortControl?.setValue('');
    datumControl?.setValue('');
    expect(ortControl?.valid).toBeFalse();
    expect(datumControl?.valid).toBeFalse();

    ortControl?.setValue('Dahab');
    datumControl?.setValue('2026-06-22');
    expect(ortControl?.valid).toBeTrue();
    expect(datumControl?.valid).toBeTrue();
  });

  it('should validate date formats using custom calendarDateValidator', () => {
    const control = new FormControl('');
    const validator = calendarDateValidator();

    control.setValue('2026/06-20');
    expect(validator(control)).toEqual({ invalidFormat: true });

    control.setValue('invalid');
    expect(validator(control)).toEqual({ invalidFormat: true });

    control.setValue('2026-13-10');
    expect(validator(control)).toEqual({ invalidMonth: true });

    control.setValue('2026-06-32');
    expect(validator(control)).toEqual({ invalidDate: true });

    // Leap year checks
    control.setValue('2024-02-29'); // 2024 is leap year
    expect(validator(control)).toBeNull();

    control.setValue('2025-02-29'); // 2025 is not leap year
    expect(validator(control)).toEqual({ invalidDate: true });

    control.setValue('2026-06-20');
    expect(validator(control)).toBeNull();
  });

  it('should validate numeric fields', () => {
    diveServiceSpy.getDraftDive.and.returnValue(null);
    fixture.detectChanges();

    const depthControl = component.diveForm.get('tiefe_m');
    const nrControl = component.diveForm.get('tauchgang_nr');

    depthControl?.setValue(-5);
    expect(depthControl?.valid).toBeFalse();

    depthControl?.setValue(12000);
    expect(depthControl?.valid).toBeFalse();

    depthControl?.setValue(18.5);
    expect(depthControl?.valid).toBeTrue();

    nrControl?.setValue(1.5); // float for an integer field
    expect(nrControl?.valid).toBeFalse();

    nrControl?.setValue(10);
    expect(nrControl?.valid).toBeTrue();
  });

  it('should allow adding and removing stamps', () => {
    diveServiceSpy.getDraftDive.and.returnValue(null);
    fixture.detectChanges();

    expect(component.stempelList.length).toBe(0);

    component.newStamp = '  Coral Garden   ';
    component.addStamp();
    expect(component.stempelList).toEqual(['Coral Garden']);
    expect(component.newStamp).toBe('');

    component.newStamp = '';
    component.addStamp(); // Should not add empty stamp
    expect(component.stempelList.length).toBe(1);

    component.removeStamp(0);
    expect(component.stempelList.length).toBe(0);
  });

  it('should submit form data and navigate to /list on success', fakeAsync(() => {
    const draftMock = {
      tauchgang_nr: 1,
      ort: 'Dahab',
      datum: '2026-06-22',
      sicht: null,
      gewicht_kg: null,
      dauer_min: null,
      tiefe_m: null,
      temperatur_c: null,
      stroemung: null,
      unterschrift_partner: null,
      stempel: ['Red Sea']
    };
    diveServiceSpy.getDraftDive.and.returnValue(draftMock);
    fixture.detectChanges();

    diveServiceSpy.saveDive.and.returnValue(of({ ...draftMock, id: 10, created_at: '2026-06-22T08:00:00Z' }));

    component.onSave();

    expect(component.saving).toBeTrue();
    expect(diveServiceSpy.saveDive).toHaveBeenCalledWith(draftMock);
    
    tick();

    expect(component.saving).toBeFalse();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/list']);
  }));

  it('should display error if saveDive API fails', fakeAsync(() => {
    diveServiceSpy.getDraftDive.and.returnValue({ ort: 'Dahab', datum: '2026-06-22', stempel: [] } as any);
    fixture.detectChanges();

    const errResponse = { error: { error: 'Database save error' } };
    diveServiceSpy.saveDive.and.returnValue(throwError(() => errResponse));

    component.onSave();
    
    tick();

    expect(component.saving).toBeFalse();
    expect(component.error).toBe('Database save error');
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  }));
});
