import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, tap } from 'rxjs/operators';

export interface DiveDraft {
  tauchgang_nr: number | null;
  ort: string;
  datum: string;
  sicht: string | null;
  gewicht_kg: number | null;
  dauer_min: number | null;
  tiefe_m: number | null;
  temperatur_c: number | null;
  stroemung: string | null;
  unterschrift_partner: string | null;
  stempel: string[];
}

export interface Dive extends DiveDraft {
  id: number;
  created_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class DiveService {
  private apiUrl = '/api';

  private draftDiveSubject = new BehaviorSubject<DiveDraft | null>(null);
  public draftDive$ = this.draftDiveSubject.asObservable();

  constructor(private http: HttpClient) {}

  getDives(): Observable<Dive[]> {
    return this.http.get<Dive[]>(`${this.apiUrl}/dives`).pipe(
      map(dives => (dives || []).map(dive => this.sanitizeDive(dive) as Dive))
    );
  }

  saveDive(dive: DiveDraft): Observable<Dive> {
    const cleaned = this.prepareForBackend(dive);
    return this.http.post<Dive>(`${this.apiUrl}/dives`, cleaned).pipe(
      map(saved => this.sanitizeDive(saved) as Dive),
      tap(() => this.setDraftDive(null))
    );
  }

  uploadImage(file: File): Observable<DiveDraft> {
    const formData = new FormData();
    formData.append('image', file, file.name);
    return this.http.post<DiveDraft>(`${this.apiUrl}/upload`, formData).pipe(
      map(draft => this.sanitizeDive(draft)),
      tap(draft => this.setDraftDive(draft))
    );
  }

  setDraftDive(dive: DiveDraft | null): void {
    this.draftDiveSubject.next(dive);
  }

  getDraftDive(): DiveDraft | null {
    return this.draftDiveSubject.value;
  }

  private sanitizeDive(dive: Partial<DiveDraft> & { id?: number; created_at?: string }): DiveDraft | Dive {
    const base = {
      tauchgang_nr: (dive.tauchgang_nr !== undefined && dive.tauchgang_nr !== null) ? Number(dive.tauchgang_nr) : null,
      ort: dive.ort || '',
      datum: dive.datum || '',
      sicht: dive.sicht || null,
      gewicht_kg: (dive.gewicht_kg !== undefined && dive.gewicht_kg !== null) ? Number(dive.gewicht_kg) : null,
      dauer_min: (dive.dauer_min !== undefined && dive.dauer_min !== null) ? Number(dive.dauer_min) : null,
      tiefe_m: (dive.tiefe_m !== undefined && dive.tiefe_m !== null) ? Number(dive.tiefe_m) : null,
      temperatur_c: (dive.temperatur_c !== undefined && dive.temperatur_c !== null) ? Number(dive.temperatur_c) : null,
      stroemung: dive.stroemung || null,
      unterschrift_partner: dive.unterschrift_partner || null,
      stempel: Array.isArray(dive.stempel) ? dive.stempel : []
    };

    if (dive.id !== undefined && dive.created_at !== undefined) {
      return {
        ...base,
        id: dive.id,
        created_at: dive.created_at
      } as Dive;
    }
    return base;
  }

  private prepareForBackend(dive: DiveDraft): Partial<DiveDraft> {
    const coerceNumber = (val: any): number | null => {
      if (val === undefined || val === null || String(val).trim() === '') return null;
      const num = Number(val);
      return Number.isFinite(num) ? num : null;
    };

    const coerceInteger = (val: any): number | null => {
      const num = coerceNumber(val);
      return num !== null ? Math.round(num) : null;
    };

    const coerceString = (val: any): string | null => {
      if (val === undefined || val === null || String(val).trim() === '') return null;
      return String(val).trim();
    };

    return {
      tauchgang_nr: coerceInteger(dive.tauchgang_nr),
      ort: String(dive.ort || '').trim(),
      datum: String(dive.datum || '').trim(),
      sicht: coerceString(dive.sicht),
      gewicht_kg: coerceNumber(dive.gewicht_kg),
      dauer_min: coerceInteger(dive.dauer_min),
      tiefe_m: coerceNumber(dive.tiefe_m),
      temperatur_c: coerceInteger(dive.temperatur_c),
      stroemung: coerceString(dive.stroemung),
      unterschrift_partner: coerceString(dive.unterschrift_partner),
      stempel: Array.isArray(dive.stempel) ? dive.stempel.filter(s => typeof s === 'string' && s.trim() !== '') : []
    };
  }
}
