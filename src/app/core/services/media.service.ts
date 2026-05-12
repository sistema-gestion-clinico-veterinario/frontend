import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class MediaService {
  private readonly uploadUrl = `${environment.apiUrl}/media/upload`;
  readonly mediaBaseUrl = `${environment.apiUrl}/media`;

  constructor(private http: HttpClient) {}

  upload(file: File): Observable<string> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ path: string }>(this.uploadUrl, formData).pipe(
      map(res => res.path)
    );
  }

  resolveUrl(path: string | null | undefined): string | null {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${this.mediaBaseUrl}/${path}`;
  }
}
