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
  bemerkungen: string | null;
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
  private apiUrl = window.location.hostname === 'logbuch.powerdesign.ch' 
    ? 'https://api.logbuch.powerdesign.ch/api'
    : '/api';

  private draftDivesSubject = new BehaviorSubject<DiveDraft[]>([]);
  public draftDives$ = this.draftDivesSubject.asObservable();

  /** @deprecated Use draftDives$ instead */
  private draftDiveSubject = new BehaviorSubject<DiveDraft | null>(null);
  public draftDive$ = this.draftDiveSubject.asObservable();

  constructor(private http: HttpClient) {}

  getDives(): Observable<Dive[]> {
    return this.http.get<Dive[]>(`${this.apiUrl}/dives`).pipe(
      map(dives => (dives || []).map(dive => this.sanitizeDive(dive) as Dive))
    );
  }

  getDiveById(id: number): Observable<Dive> {
    return this.http.get<Dive>(`${this.apiUrl}/dives/${id}`).pipe(
      map(dive => this.sanitizeDive(dive) as Dive)
    );
  }

  saveDive(dive: DiveDraft): Observable<Dive> {
    const cleaned = this.prepareForBackend(dive);
    return this.http.post<Dive>(`${this.apiUrl}/dives`, cleaned).pipe(
      map(saved => this.sanitizeDive(saved) as Dive),
      tap(() => this.setDraftDive(null))
    );
  }

  updateDive(id: number, dive: DiveDraft): Observable<Dive> {
    const cleaned = this.prepareForBackend(dive);
    return this.http.put<Dive>(`${this.apiUrl}/dives/${id}`, cleaned).pipe(
      map(saved => this.sanitizeDive(saved) as Dive)
    );
  }

  deleteDive(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/dives/${id}`);
  }

  uploadImage(file: File): Observable<{ dives: DiveDraft[], skipped: number }> {
    const formData = new FormData();
    formData.append('image', file, file.name);
    return this.http.post<any>(`${this.apiUrl}/upload`, formData).pipe(
      map(response => {
        // Handle both legacy single-object response and new multi-dive { dives, skipped }
        let dives: DiveDraft[];
        let skipped = 0;
        if (Array.isArray(response?.dives)) {
          dives = response.dives.map((d: any) => this.sanitizeDive(d));
          skipped = response.skipped ?? 0;
        } else {
          // Legacy: single dive object
          dives = [this.sanitizeDive(response)];
        }
        return { dives, skipped };
      }),
      tap(({ dives }) => {
        this.draftDivesSubject.next(dives);
        // backward compat: set first draft in legacy subject
        this.draftDiveSubject.next(dives[0] ?? null);
      })
    );
  }

  setDraftDives(dives: DiveDraft[]): void {
    this.draftDivesSubject.next(dives);
    this.draftDiveSubject.next(dives[0] ?? null);
  }

  getDraftDives(): DiveDraft[] {
    return this.draftDivesSubject.value;
  }

  setDraftDive(dive: DiveDraft | null): void {
    const dives = dive ? [dive] : [];
    this.draftDivesSubject.next(dives);
    this.draftDiveSubject.next(dive);
  }

  getDraftDive(): DiveDraft | null {
    return this.draftDiveSubject.value;
  }

  private sanitizeDive(dive: Partial<DiveDraft> & { id?: number; created_at?: string }): DiveDraft | Dive {
    const cleanStr = (s: any) => {
      if (s === undefined || s === null) return null;
      const str = String(s).trim();
      return (str === '' || str.toLowerCase() === 'null') ? null : str;
    };

    const base = {
      tauchgang_nr: (dive.tauchgang_nr !== undefined && dive.tauchgang_nr !== null && String(dive.tauchgang_nr).toLowerCase() !== 'null') ? Number(dive.tauchgang_nr) : null,
      ort: cleanStr(dive.ort) || '',
      datum: cleanStr(dive.datum) || '',
      sicht: cleanStr(dive.sicht),
      gewicht_kg: (dive.gewicht_kg !== undefined && dive.gewicht_kg !== null && String(dive.gewicht_kg).toLowerCase() !== 'null') ? Number(dive.gewicht_kg) : null,
      dauer_min: (dive.dauer_min !== undefined && dive.dauer_min !== null && String(dive.dauer_min).toLowerCase() !== 'null') ? Number(dive.dauer_min) : null,
      tiefe_m: (dive.tiefe_m !== undefined && dive.tiefe_m !== null && String(dive.tiefe_m).toLowerCase() !== 'null') ? Number(dive.tiefe_m) : null,
      temperatur_c: (dive.temperatur_c !== undefined && dive.temperatur_c !== null && String(dive.temperatur_c).toLowerCase() !== 'null') ? Number(dive.temperatur_c) : null,
      stroemung: cleanStr(dive.stroemung),
      unterschrift_partner: cleanStr(dive.unterschrift_partner),
      bemerkungen: cleanStr(dive.bemerkungen),
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
      if (val === undefined || val === null) return null;
      const s = String(val).trim();
      if (s === '' || s.toLowerCase() === 'null') return null;
      return s;
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
      bemerkungen: coerceString(dive.bemerkungen),
      stempel: Array.isArray(dive.stempel) ? dive.stempel.filter(s => typeof s === 'string' && s.trim() !== '') : []
    };
  }
}
