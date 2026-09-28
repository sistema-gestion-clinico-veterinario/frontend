import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';
import { SKIP_GLOBAL_LOADING } from '../interceptors/api.interceptor';

@Injectable({ providedIn: 'root' })
export class RealtimeTicketService {
  private readonly http = inject(HttpClient);

  issue() {
    return this.http.post<ApiResponse<{ ticket: string }>>(
      `${environment.apiUrl}/realtime/ticket`, {},
      { context: new HttpContext().set(SKIP_GLOBAL_LOADING, true) }
    );
  }
}
