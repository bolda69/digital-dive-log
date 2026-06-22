import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { throwError, defer } from 'rxjs';
import { UploadComponent } from './upload.component';
import { DiveService } from '../../services/dive.service';

describe('UploadComponent', () => {
  let component: UploadComponent;
  let fixture: ComponentFixture<UploadComponent>;
  let diveServiceSpy: jasmine.SpyObj<DiveService>;
  let router: Router;

  beforeEach(async () => {
    const serviceSpy = jasmine.createSpyObj('DiveService', ['uploadImage']);

    await TestBed.configureTestingModule({
      declarations: [UploadComponent],
      imports: [RouterTestingModule],
      providers: [
        { provide: DiveService, useValue: serviceSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(UploadComponent);
    component = fixture.componentInstance;
    diveServiceSpy = TestBed.inject(DiveService) as jasmine.SpyObj<DiveService>;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate');
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
    diveServiceSpy.uploadImage.and.returnValue(defer(() => Promise.resolve({
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
    })));

    component.uploadImage();

    expect(component.loading).toBeTrue();
    tick(); // resolve uploadImage observable

    expect(diveServiceSpy.uploadImage).toHaveBeenCalledWith(file);
    expect(component.loading).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/verification']);
  }));

  it('should set error message on upload failure', fakeAsync(() => {
    const file = new File(['mock content'], 'test.png', { type: 'image/png' });
    component.selectedFile = file;
    diveServiceSpy.uploadImage.and.returnValue(defer(() => Promise.reject(new Error('Upload error'))));

    component.uploadImage();

    expect(component.loading).toBeTrue();
    tick();

    expect(diveServiceSpy.uploadImage).toHaveBeenCalledWith(file);
    expect(component.loading).toBeFalse();
    expect(component.errorMessage).toBe('Upload failed. The image could not be processed. Please try again.');
    expect(router.navigate).not.toHaveBeenCalled();
  }));
});
