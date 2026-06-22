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
        // Sort dives descending chronologically (by datum), and then by dive number (tauchgang_nr)
        this.dives = data.sort((a, b) => {
          const dateComparison = b.datum.localeCompare(a.datum);
          if (dateComparison !== 0) {
            return dateComparison;
          }
          const nrA = a.tauchgang_nr ?? 0;
          const nrB = b.tauchgang_nr ?? 0;
          return nrB - nrA;
        });
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = 'Failed to load dive logs. Please try again later.';
        console.error(err);
      }
    });
  }
}
