import { Component, OnInit } from '@angular/core';
import { DiveService, Dive } from '../../services/dive.service';

// Normalize English visibility values from older AI responses
const SICHT_MAP: Record<string, string> = {
  'good': 'gut', 'great': 'gut', 'excellent': 'gut', 'sehr gut': 'gut',
  'moderate': 'mässig', 'ok': 'mässig', 'okay': 'mässig', 'medium': 'mässig', 'fair': 'mässig', 'mittel': 'mässig',
  'poor': 'schlecht', 'bad': 'schlecht', 'terrible': 'schlecht'
};

@Component({
  selector: 'app-list',
  templateUrl: './list.component.html',
  styleUrls: ['./list.component.css']
})
export class ListComponent implements OnInit {
  dives: Dive[] = [];
  loading = false;
  errorMessage: string | null = null;

  constructor(private diveService: DiveService) {}

  ngOnInit(): void {
    this.fetchDives();
  }

  fetchDives(): void {
    this.loading = true;
    this.errorMessage = null;

    this.diveService.getDives().subscribe({
      next: (data) => {
        this.loading = false;
        // Sort: highest tauchgang_nr first; fallback to newest datum
        this.dives = data.sort((a, b) => {
          const nrA = a.tauchgang_nr ?? -1;
          const nrB = b.tauchgang_nr ?? -1;
          if (nrB !== nrA) return nrB - nrA;
          return b.datum.localeCompare(a.datum);
        });
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = 'Fehler beim Laden des Tauchlogbuchs.';
        console.error(err);
      }
    });
  }

  normalizeSicht(sicht: string | null): string | null {
    if (!sicht) return null;
    const key = sicht.trim().toLowerCase();
    return SICHT_MAP[key] ?? sicht;
  }

  sichtIcon(sicht: string | null): string {
    const s = this.normalizeSicht(sicht)?.toLowerCase() ?? '';
    if (s === 'gut') return '😊';
    if (s === 'mässig') return '😐';
    if (s === 'schlecht') return '😞';
    return '👁️';
  }

  deleteDive(event: Event, id: number, nr: number | null): void {
    event.stopPropagation();
    event.preventDefault();
    const nrText = nr ? `Tauchgang #${nr}` : `Tauchgang`;
    if (confirm(`Möchtest du "${nrText}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) {
      this.diveService.deleteDive(id).subscribe({
        next: () => {
          this.fetchDives();
        },
        error: (err) => {
          console.error('Fehler beim Löschen:', err);
          alert('Fehler beim Löschen des Tauchgangs.');
        }
      });
    }
  }
}
