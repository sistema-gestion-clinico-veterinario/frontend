import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';
import { ThesisPerformanceMeasurement } from '../../models/response/thesis-performance-measurement-response';
import { SKIP_GLOBAL_LOADING } from '../interceptors/api.interceptor';

@Injectable({ providedIn: 'root' })
export class ThesisPerformanceMeasurementService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/thesis/performance-measurements`;

  findSession(sessionId: string) {
    const params = new HttpParams().set('sessionId', sessionId);
    const context = new HttpContext().set(SKIP_GLOBAL_LOADING, true);
    return this.http.get<ApiResponse<ThesisPerformanceMeasurement[]>>(this.apiUrl, { params, context });
  }
}
