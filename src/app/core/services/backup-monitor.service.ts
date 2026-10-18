import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { BackupExecution, BackupSummary } from '../../models/backup/backup-execution.model';
import { ApiResponse } from '../../models/response/api-response';
import { Page } from '../../models/response/page';

@Injectable({ providedIn: 'root' })
export class BackupMonitorService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/admin/backups`;

  list(page = 0, size = 20) {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<ApiResponse<Page<BackupExecution>>>(this.apiUrl, { params });
  }

  summary() {
    return this.http.get<ApiResponse<BackupSummary>>(`${this.apiUrl}/summary`);
  }
}
