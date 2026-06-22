import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ListComponent } from './list.component';
import { DiveService, Dive } from '../../services/dive.service';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('ListComponent', () => {
  let component: ListComponent;
  let fixture: ComponentFixture<ListComponent>;
  let diveServiceSpy: jasmine.SpyObj<DiveService>;

  const mockDives: Dive[] = [
    {
      id: 1,
      tauchgang_nr: 10,
      ort: 'Dahab Blue Hole',
      datum: '2026-06-20',
      sicht: '20m',
      gewicht_kg: 8.0,
      dauer_min: 45,
      tiefe_m: 28.5,
      temperatur_c: 24,
      stroemung: 'mild',
      unterschrift_partner: 'John Doe',
      stempel: ['Scuba Club Dahab'],
      created_at: '2026-06-21T20:42:00Z'
    },
    {
      id: 2,
      tauchgang_nr: 11,
      ort: 'El Fanadir',
      datum: '2026-06-21',
      sicht: '15m',
      gewicht_kg: 6.0,
      dauer_min: 50,
      tiefe_m: 18.0,
      temperatur_c: 26,
      stroemung: 'none',
      unterschrift_partner: 'Jane Doe',
      stempel: [],
      created_at: '2026-06-22T08:00:00Z'
    }
  ];

  beforeEach(async () => {
    const dSpy = jasmine.createSpyObj('DiveService', ['getDives']);

    await TestBed.configureTestingModule({
      declarations: [ ListComponent ],
      imports: [ RouterTestingModule, HttpClientTestingModule ],
      providers: [
        { provide: DiveService, useValue: dSpy }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ListComponent);
    component = fixture.componentInstance;
    diveServiceSpy = TestBed.inject(DiveService) as jasmine.SpyObj<DiveService>;
  });

  it('should fetch dives on init and sort descending by date by default', fakeAsync(() => {
    diveServiceSpy.getDives.and.returnValue(of(mockDives));
    fixture.detectChanges();
    tick();

    expect(diveServiceSpy.getDives).toHaveBeenCalled();
    expect(component.dives.length).toBe(2);
    // Default sorting is by date descending, so 2026-06-21 should be first
    expect(component.dives[0].id).toBe(2);
    expect(component.dives[1].id).toBe(1);
    expect(component.loading).toBeFalse();
  }));

  it('should handle sorting toggle', fakeAsync(() => {
    diveServiceSpy.getDives.and.returnValue(of(mockDives));
    fixture.detectChanges();
    tick();

    // Toggle sort on datum to ascending
    component.toggleSort('datum');
    expect(component.sortBy).toBe('datum');
    expect(component.sortDesc).toBeFalse();
    expect(component.dives[0].id).toBe(1); // 2026-06-20 first

    // Toggle sort to descending again
    component.toggleSort('datum');
    expect(component.sortDesc).toBeTrue();
    expect(component.dives[0].id).toBe(2); // 2026-06-21 first

    // Toggle sort to another field (e.g., tauchgang_nr)
    component.toggleSort('tauchgang_nr');
    expect(component.sortBy).toBe('tauchgang_nr');
    expect(component.sortDesc).toBeTrue(); // default for new field is desc
    expect(component.dives[0].tauchgang_nr).toBe(11);
  }));

  it('should display error message on API failure', fakeAsync(() => {
    diveServiceSpy.getDives.and.returnValue(throwError(() => new Error('Server error')));
    fixture.detectChanges();
    tick();

    expect(component.loading).toBeFalse();
    expect(component.error).toContain('Fehler beim Laden');
    expect(component.dives.length).toBe(0);
  }));
});
