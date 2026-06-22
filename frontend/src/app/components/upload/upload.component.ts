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
  previewUrl: string | ArrayBuffer | null = null;
  loading = false;
  errorMessage: string | null = null;
  isDragOver = false;

  constructor(
    private diveService: DiveService,
    private router: Router
  ) {}

  triggerFileInput(): void {
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    fileInput?.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.setFile(input.files[0]);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(): void {
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      this.setFile(event.dataTransfer.files[0]);
    }
  }

  private setFile(file: File): void {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      this.errorMessage = 'Please select a valid image file (PNG, JPG, JPEG, GIF).';
      return;
    }
    this.selectedFile = file;
    this.errorMessage = null;

    const reader = new FileReader();
    reader.onload = () => {
      this.previewUrl = reader.result;
    };
    reader.readAsDataURL(file);
  }

  clearSelection(): void {
    this.selectedFile = null;
    this.previewUrl = null;
    this.errorMessage = null;
  }

  uploadImage(): void {
    if (!this.selectedFile) {
      this.errorMessage = 'No file selected.';
      return;
    }

    this.loading = true;
    this.errorMessage = null;

    this.diveService.uploadImage(this.selectedFile).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/verify']);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = 'Upload failed. The image could not be processed. Please try again.';
        console.error(err);
      }
    });
  }
}
