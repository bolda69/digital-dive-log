import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { DiveService } from '../../services/dive.service';

@Component({
  selector: 'app-upload',
  templateUrl: './upload.component.html',
  styleUrls: ['./upload.component.css']
})
export class UploadComponent {
  selectedFile: File | null = null;
  uploading = false;
  error: string | null = null;

  constructor(private diveService: DiveService, private router: Router) {}

  onFileSelected(event: any): void {
    const file = event.target.files?.[0];
    if (file) {
      this.selectedFile = file;
      this.error = null;
    }
  }

  onUpload(): void {
    if (!this.selectedFile) {
      this.error = 'Bitte wählen Sie zuerst ein Foto aus.';
      return;
    }

    this.uploading = true;
    this.error = null;

    this.diveService.uploadImage(this.selectedFile).subscribe({
      next: (draft) => {
        this.uploading = false;
        this.router.navigate(['/verification']);
      },
      error: (err) => {
        this.uploading = false;
        this.error = err.error?.error || 'Fehler beim Upload des Bildes. Bitte versuchen Sie es erneut.';
      }
    });
  }
}
