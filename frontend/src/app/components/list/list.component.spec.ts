import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { throwError, defer } from 'rxjs';
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

    diveServiceSpy.getDives.and.returnValue(defer(() => Promise.resolve(mockDives)));

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
    diveServiceSpy.getDives.and.returnValue(defer(() => Promise.reject(new Error('API error'))));

    fixture.detectChanges(); // ngOnInit

    expect(component.loading).toBeTrue();
    tick();

    expect(component.loading).toBeFalse();
    expect(component.dives.length).toBe(0);
    expect(component.errorMessage).toBe('Failed to load dive logs. Please try again later.');
  }));
});
