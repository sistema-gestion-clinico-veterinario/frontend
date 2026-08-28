import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, from, map, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ImageUploadOptimizerService } from './image-upload-optimizer.service';

@Injectable({ providedIn: 'root' })
export class MediaService {
  private readonly uploadUrl = `${environment.apiUrl}/media/upload`;
  readonly mediaBaseUrl = `${environment.apiUrl}/media`;

  constructor(
    private http: HttpClient,
    private imageOptimizer: ImageUploadOptimizerService
  ) {}

  upload(file: File): Observable<string> {
    return from(this.imageOptimizer.optimize(file)).pipe(
      switchMap(optimizedFile => {
        const formData = new FormData();
        formData.append('file', optimizedFile);
        formData.append('originalSize', file.size.toString());
        return this.http.post<{ path: string }>(this.uploadUrl, formData);
      }),
      map(response => response.path)
    );
  }

  resolveUrl(path: string | null | undefined): string | null {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${this.mediaBaseUrl}/${path}`;
  }
}
