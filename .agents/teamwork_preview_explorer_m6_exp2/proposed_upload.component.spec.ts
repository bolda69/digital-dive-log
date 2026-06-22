import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { UploadComponent } from './upload.component';
import { DiveService } from '../../services/dive.service';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('UploadComponent', () => {
  let component: UploadComponent;
  let fixture: ComponentFixture<UploadComponent>;
  let diveServiceSpy: jasmine.SpyObj<DiveService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    const dSpy = jasmine.createSpyObj('DiveService', ['uploadImage']);
    const rSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      declarations: [ UploadComponent ],
      imports: [ RouterTestingModule, HttpClientTestingModule ],
      providers: [
        { provide: DiveService, useValue: dSpy },
        { provide: Router, useValue: rSpy }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UploadComponent);
    component = fixture.componentInstance;
    diveServiceSpy = TestBed.inject(DiveService) as jasmine.SpyObj<DiveService>;
    routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should assign selected file on change', () => {
    const file = new File(['image-data'], 'test-log.png', { type: 'image/png' });
    const event = { target: { files: [file] } };

    component.onFileSelected(event);

    expect(component.selectedFile).toBe(file);
    expect(component.error).toBeNull();
  });

  it('should call uploadImage and navigate to /verification on success', fakeAsync(() => {
    const file = new File(['image-data'], 'test-log.png', { type: 'image/png' });
    component.selectedFile = file;

    diveServiceSpy.uploadImage.and.returnValue(of({
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
      stempel: []
    }));

    component.onUpload();

    expect(component.uploading).toBeTrue();
    expect(diveServiceSpy.uploadImage).toHaveBeenCalledWith(file);
    
    tick();

    expect(component.uploading).toBeFalse();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/verification']);
  }));

  it('should handle error when uploadImage fails', fakeAsync(() => {
    const file = new File(['image-data'], 'test-log.png', { type: 'image/png' });
    component.selectedFile = file;

    const errorResponse = { error: { error: 'Gemini extraction failed' } };
    diveServiceSpy.uploadImage.and.returnValue(throwError(() => errorResponse));

    component.onUpload();

    expect(component.uploading).toBeTrue();
    
    tick();

    expect(component.uploading).toBeFalse();
    expect(component.error).toBe('Gemini extraction failed');
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  }));
});
