import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { DiveService } from '../../services/dive.service';

type UploadState = 'idle' | 'uploading' | 'error' | 'all-duplicates';

@Component({
  selector: 'app-upload',
  templateUrl: './upload.component.html',
  styleUrls: ['./upload.component.css']
})
export class UploadComponent {
  state: UploadState = 'idle';
  errorMessage: string | null = null;
  skippedCount = 0;
  dragOver = false;

  previewUrl: string | null = null;
  selectedFile: File | null = null;

  constructor(private diveService: DiveService, private router: Router) {}

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.setFile(input.files[0]);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver = false;
    const files = event.dataTransfer?.files;
    if (files && files[0]) {
      this.setFile(files[0]);
    }
  }

  private setFile(file: File): void {
    if (!file.type.startsWith('image/')) {
      this.errorMessage = 'Bitte nur Bilddateien hochladen (JPG, PNG, etc.)';
      return;
    }
    this.selectedFile = file;
    this.errorMessage = null;
    const reader = new FileReader();
    reader.onload = (e) => {
      this.previewUrl = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  clearSelection(): void {
    this.selectedFile = null;
    this.previewUrl = null;
    this.errorMessage = null;
    this.state = 'idle';
  }

  uploadImage(): void {
    if (!this.selectedFile) return;

    this.state = 'uploading';
    this.errorMessage = null;
    this.skippedCount = 0;

    this.diveService.uploadImage(this.selectedFile).subscribe({
      next: ({ dives, skipped }) => {
        this.skippedCount = skipped;
        if (dives.length === 0) {
          this.state = 'all-duplicates';
        } else {
          this.router.navigate(['/verify']);
        }
      },
      error: (err) => {
        this.state = 'error';
        if (err.status === 400) {
          this.errorMessage = err.error?.error || 'Das Bild konnte nicht verarbeitet werden.';
        } else if (err.status === 0) {
          this.errorMessage = 'Keine Verbindung zum Server. Ist das Backend gestartet?';
        } else {
          this.errorMessage = `Fehler beim Hochladen (${err.status}). Bitte erneut versuchen.`;
        }
      }
    });
  }
}
