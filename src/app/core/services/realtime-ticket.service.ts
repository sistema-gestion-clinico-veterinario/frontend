import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';

@Injectable({ providedIn: 'root' })
export class RealtimeTicketService {
  private readonly http = inject(HttpClient);

  issue() {
    return this.http.post<ApiResponse<{ ticket: string }>>(
      `${environment.apiUrl}/realtime/ticket`, {}
    );
  }
}
