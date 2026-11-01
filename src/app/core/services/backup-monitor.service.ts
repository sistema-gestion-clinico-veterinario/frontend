import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { BackupExecution, BackupSummary } from '../../models/backup/backup-execution.model';
import { ApiResponse } from '../../models/response/api-response';
import { Page } from '../../models/response/page';
import { SKIP_GLOBAL_LOADING } from '../interceptors/http-context.tokens';

@Injectable({ providedIn: 'root' })
export class BackupMonitorService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/admin/backups`;

  list(page = 0, size = 20, skipGlobalLoading = false) {
    const params = new HttpParams().set('page', page).set('size', size);
    const context = skipGlobalLoading
      ? new HttpContext().set(SKIP_GLOBAL_LOADING, true)
      : undefined;
    return this.http.get<ApiResponse<Page<BackupExecution>>>(this.apiUrl, { params, context });
  }

  summary() {
    return this.http.get<ApiResponse<BackupSummary>>(`${this.apiUrl}/summary`);
  }
}
