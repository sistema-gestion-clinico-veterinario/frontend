import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  AccessReviewDecisionRequest,
  AccessReviewDetail,
  AccessReviewOverview,
  AccessReviewSummary
} from '../../models/access-review/access-review.model';
import { ApiResponse } from '../../models/response/api-response';

@Injectable({ providedIn: 'root' })
export class AccessReviewService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/admin/access-reviews`;

  obtener(companyId?: number | null) {
    return this.http.get<ApiResponse<AccessReviewOverview>>(this.apiUrl, { params: this.params(companyId) });
  }

  registrar(decisions: AccessReviewDecisionRequest[], notes: string, companyId?: number | null) {
    return this.http.post<ApiResponse<AccessReviewSummary>>(
      this.apiUrl,
      { decisions, notes: notes.trim() || null },
      { params: this.params(companyId) }
    );
  }

  historial(companyId?: number | null) {
    return this.http.get<ApiResponse<AccessReviewSummary[]>>(`${this.apiUrl}/history`, { params: this.params(companyId) });
  }

  detalle(reviewId: number, companyId?: number | null) {
    return this.http.get<ApiResponse<AccessReviewDetail>>(`${this.apiUrl}/${reviewId}`, { params: this.params(companyId) });
  }

  private params(companyId?: number | null): HttpParams {
    return companyId ? new HttpParams().set('companyId', companyId) : new HttpParams();
  }
}
