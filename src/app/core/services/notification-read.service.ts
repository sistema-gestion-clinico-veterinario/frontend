import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';
import { SKIP_GLOBAL_LOADING } from '../interceptors/http-context.tokens';

@Injectable({ providedIn: 'root' })
export class NotificationReadService {
  private readonly http = inject(HttpClient);
  private readonly context = new HttpContext().set(SKIP_GLOBAL_LOADING, true);

  listRead() {
    return this.http.get<ApiResponse<string[]>>(`${environment.apiUrl}/notifications/read`, {
      context: this.context
    });
  }

  markRead(notificationKey: string) {
    return this.http.put<ApiResponse<void>>(
      `${environment.apiUrl}/notifications/${encodeURIComponent(notificationKey)}/read`,
      {},
      { context: this.context }
    );
  }
}
