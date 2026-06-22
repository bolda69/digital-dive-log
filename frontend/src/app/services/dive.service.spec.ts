import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { DiveService, DiveDraft, Dive } from './dive.service';

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

  describe('Shared State', () => {
    it('should set, get, and clear draft dive state', () => {
      const mockDraft: DiveDraft = {
        tauchgang_nr: 1,
        ort: 'El Minya wreck',
        datum: '2026-06-21',
        sicht: null,
        gewicht_kg: null,
        dauer_min: null,
        tiefe_m: null,
        temperatur_c: null,
        stroemung: null,
        unterschrift_partner: null,
        stempel: []
      };

      expect(service.getDraftDive()).toBeNull();
      service.setDraftDive(mockDraft);
      expect(service.getDraftDive()).toEqual(mockDraft);
      service.setDraftDive(null);
      expect(service.getDraftDive()).toBeNull();
    });
  });

  describe('API Calls', () => {
    it('should perform GET /api/dives and sanitize response attributes', () => {
      const mockBackendResponse = [
        {
          id: 42,
          tauchgang_nr: 527,
          ort: 'Dahab Blue Hole',
          datum: '2026-06-20',
          stempel: null,
          created_at: '2026-06-21T20:42:00Z'
        }
      ];

      service.getDives().subscribe(dives => {
        expect(dives.length).toBe(1);
        expect(dives[0].id).toBe(42);
        expect(dives[0].stempel).toEqual([]); // mapped null to empty array
      });

      const req = httpMock.expectOne('/api/dives');
      expect(req.request.method).toBe('GET');
      req.flush(mockBackendResponse);
    });

    it('should upload log image (POST /api/upload) using FormData', () => {
      const mockFile = new File(['image-binary-data'], 'dive_log_photo.jpg', { type: 'image/jpeg' });
      const mockResponse: DiveDraft = {
        tauchgang_nr: null,
        ort: 'Mocked Extracted Location',
        datum: '2026-06-22',
        sicht: null,
        gewicht_kg: null,
        dauer_min: null,
        tiefe_m: null,
        temperatur_c: null,
        stroemung: null,
        unterschrift_partner: null,
        stempel: []
      };

      service.uploadImage(mockFile).subscribe(draft => {
        expect(draft.ort).toBe('Mocked Extracted Location');
        expect(service.getDraftDive()).toEqual(draft); // Stored in state
      });

      const req = httpMock.expectOne('/api/upload');
      expect(req.request.method).toBe('POST');
      expect(req.request.body instanceof FormData).toBeTrue();
      expect(req.request.body.has('image')).toBeTrue();
      req.flush(mockResponse);
    });

    it('should POST /api/dives with sanitized and coerced inputs', () => {
      const inputDraft: DiveDraft = {
        tauchgang_nr: 101.9, // Should round to 102
        ort: '  Marsa Alam  ',
        datum: '2026-06-20',
        sicht: '  ', // Should convert to null
        gewicht_kg: undefined as any, // Should convert to null
        dauer_min: 42,
        tiefe_m: 18.5,
        temperatur_c: null,
        stroemung: '', // Should convert to null
        unterschrift_partner: null,
        stempel: ['Scuba Club', '   ', 'Another Stamp'] // Empty stamp filters out
      };

      const expectedSavedResponse: Dive = {
        id: 15,
        tauchgang_nr: 102,
        ort: 'Marsa Alam',
        datum: '2026-06-20',
        sicht: null,
        gewicht_kg: null,
        dauer_min: 42,
        tiefe_m: 18.5,
        temperatur_c: null,
        stroemung: null,
        unterschrift_partner: null,
        stempel: ['Scuba Club', 'Another Stamp'],
        created_at: '2026-06-22T08:00:00Z'
      };

      service.saveDive(inputDraft).subscribe(saved => {
        expect(saved).toEqual(expectedSavedResponse);
        expect(service.getDraftDive()).toBeNull(); // Cleared after save
      });

      const req = httpMock.expectOne('/api/dives');
      expect(req.request.method).toBe('POST');

      // Check payload conversion before forwarding to server
      expect(req.request.body.tauchgang_nr).toBe(102);
      expect(req.request.body.ort).toBe('Marsa Alam');
      expect(req.request.body.sicht).toBeNull();
      expect(req.request.body.gewicht_kg).toBeNull();
      expect(req.request.body.stroemung).toBeNull();
      expect(req.request.body.stempel).toEqual(['Scuba Club', 'Another Stamp']);

      req.flush(expectedSavedResponse);
    });
  });

  describe('Adversarial & Edge Cases (Challenger Verification)', () => {
    it('should propagate draft state reactively via draftDive$', (done) => {
      const mockDraft: DiveDraft = {
        tauchgang_nr: 2,
        ort: 'Fury Shoals',
        datum: '2026-06-22',
        sicht: '30m',
        gewicht_kg: 6,
        dauer_min: 50,
        tiefe_m: 15.4,
        temperatur_c: 26,
        stroemung: 'none',
        unterschrift_partner: 'Buddy',
        stempel: ['Club']
      };

      let emissions: (DiveDraft | null)[] = [];
      const sub = service.draftDive$.subscribe(val => {
        emissions.push(val);
      });

      expect(emissions).toEqual([null]);

      service.setDraftDive(mockDraft);
      expect(emissions).toEqual([null, mockDraft]);

      service.setDraftDive(null);
      expect(emissions).toEqual([null, mockDraft, null]);

      sub.unsubscribe();
      done();
    });

    it('should coerce empty string inputs to null during saveDive prepareForBackend', () => {
      const inputDraft: DiveDraft = {
        tauchgang_nr: '' as any, // empty string
        ort: 'Coercion Test',
        datum: '2026-06-22',
        sicht: '   ', // whitespace only
        gewicht_kg: '  ' as any, // whitespace only
        dauer_min: '' as any,
        tiefe_m: '' as any,
        temperatur_c: '' as any,
        stroemung: '',
        unterschrift_partner: '   ',
        stempel: []
      };

      const expectedSavedResponse: Dive = {
        id: 99,
        tauchgang_nr: null,
        ort: 'Coercion Test',
        datum: '2026-06-22',
        sicht: null,
        gewicht_kg: null,
        dauer_min: null,
        tiefe_m: null,
        temperatur_c: null,
        stroemung: null,
        unterschrift_partner: null,
        stempel: [],
        created_at: '2026-06-22T08:00:00Z'
      };

      service.saveDive(inputDraft).subscribe(saved => {
        expect(saved.tauchgang_nr).toBeNull();
        expect(saved.sicht).toBeNull();
        expect(saved.gewicht_kg).toBeNull();
        expect(saved.dauer_min).toBeNull();
        expect(saved.tiefe_m).toBeNull();
        expect(saved.temperatur_c).toBeNull();
        expect(saved.stroemung).toBeNull();
        expect(saved.unterschrift_partner).toBeNull();
      });

      const req = httpMock.expectOne('/api/dives');
      expect(req.request.method).toBe('POST');
      expect(req.request.body.tauchgang_nr).toBeNull();
      expect(req.request.body.sicht).toBeNull();
      expect(req.request.body.gewicht_kg).toBeNull();
      expect(req.request.body.dauer_min).toBeNull();
      expect(req.request.body.tiefe_m).toBeNull();
      expect(req.request.body.temperatur_c).toBeNull();
      expect(req.request.body.stroemung).toBeNull();
      expect(req.request.body.unterschrift_partner).toBeNull();

      req.flush(expectedSavedResponse);
    });

    it('should round integers and preserve floats during saveDive prepareForBackend', () => {
      const inputDraft: DiveDraft = {
        tauchgang_nr: 12.4, // integer, should round down to 12
        ort: 'Rounding & Float Test',
        datum: '2026-06-22',
        sicht: null,
        gewicht_kg: 8.56, // float, should be preserved
        dauer_min: 45.6, // integer, should round up to 46
        tiefe_m: 22.35, // float, should be preserved
        temperatur_c: 22.5, // integer, should round up to 23
        stroemung: null,
        unterschrift_partner: null,
        stempel: []
      };

      const expectedSavedResponse: Dive = {
        id: 100,
        tauchgang_nr: 12,
        ort: 'Rounding & Float Test',
        datum: '2026-06-22',
        sicht: null,
        gewicht_kg: 8.56,
        dauer_min: 46,
        tiefe_m: 22.35,
        temperatur_c: 23,
        stroemung: null,
        unterschrift_partner: null,
        stempel: [],
        created_at: '2026-06-22T08:00:00Z'
      };

      service.saveDive(inputDraft).subscribe();

      const req = httpMock.expectOne('/api/dives');
      expect(req.request.body.tauchgang_nr).toBe(12);
      expect(req.request.body.gewicht_kg).toBe(8.56);
      expect(req.request.body.dauer_min).toBe(46);
      expect(req.request.body.tiefe_m).toBe(22.35);
      expect(req.request.body.temperatur_c).toBe(23);

      req.flush(expectedSavedResponse);
    });

    it('should handle non-array stempel input and filter invalid array items during saveDive prepareForBackend', () => {
      const inputDraft: DiveDraft = {
        tauchgang_nr: null,
        ort: 'Stempel Test',
        datum: '2026-06-22',
        sicht: null,
        gewicht_kg: null,
        dauer_min: null,
        tiefe_m: null,
        temperatur_c: null,
        stroemung: null,
        unterschrift_partner: null,
        stempel: null as any // Invalid stempel type (null)
      };

      service.saveDive(inputDraft).subscribe();
      let req = httpMock.expectOne('/api/dives');
      expect(req.request.body.stempel).toEqual([]);
      req.flush({ ...inputDraft, id: 101, created_at: '2026-06-22' });

      const inputDraft2: DiveDraft = {
        ...inputDraft,
        stempel: 'not-an-array' as any // Invalid stempel type (string)
      };

      service.saveDive(inputDraft2).subscribe();
      req = httpMock.expectOne('/api/dives');
      expect(req.request.body.stempel).toEqual([]);
      req.flush({ ...inputDraft2, id: 102, created_at: '2026-06-22' });

      const inputDraft3: DiveDraft = {
        ...inputDraft,
        stempel: [123, null, undefined, 'Valid Stamp', '   ', {}, 'Another Valid'] as any
      };

      service.saveDive(inputDraft3).subscribe();
      req = httpMock.expectOne('/api/dives');
      expect(req.request.body.stempel).toEqual(['Valid Stamp', 'Another Valid']);
      req.flush({ ...inputDraft3, id: 103, created_at: '2026-06-22' });
    });
  });
});

