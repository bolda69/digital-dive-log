import { Component, OnInit } from '@angular/core';
import { DiveService, Dive } from '../../services/dive.service';

@Component({
  selector: 'app-list',
  templateUrl: './list.component.html',
  styleUrls: ['./list.component.css']
})
export class ListComponent implements OnInit {
  dives: Dive[] = [];
  loading = false;
  error: string | null = null;
  
  sortBy = 'datum';
  sortDesc = true;

  constructor(private diveService: DiveService) {}

  ngOnInit(): void {
    this.fetchDives();
  }

  fetchDives(): void {
    this.loading = true;
    this.error = null;
    this.diveService.getDives().subscribe({
      next: (data) => {
        this.dives = data;
        this.loading = false;
        this.sortDives();
      },
      error: (err) => {
        this.loading = false;
        this.error = 'Fehler beim Laden der Tauchgänge. Bitte versuchen Sie es später noch einmal.';
      }
    });
  }

  toggleSort(field: string): void {
    if (this.sortBy === field) {
      this.sortDesc = !this.sortDesc;
    } else {
      this.sortBy = field;
      this.sortDesc = true; // default to desc for new field
    }
    this.sortDives();
  }

  sortDives(): void {
    this.dives.sort((a, b) => {
      let valA = a[this.sortBy as keyof Dive];
      let valB = b[this.sortBy as keyof Dive];

      // Handle null/undefined values by placing them at the end
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      if (typeof valA === 'string' && typeof valB === 'string') {
        return this.sortDesc
          ? valB.localeCompare(valA)
          : valA.localeCompare(valB);
      }

      if (typeof valA === 'number' && typeof valB === 'number') {
        return this.sortDesc
          ? valB - valA
          : valA - valB;
      }

      return 0;
    });
  }
}
