import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';

export type AccessReviewDecision = 'KEEP' | 'REVOKE';

export interface AccessReviewItem {
  assignmentId: number;
  usuarioId: number;
  nombre: string;
  email: string | null;
  roleId: number;
  roleName: string;
  reasons: string[];
  lastActivity: string | null;
  assignedAt: string | null;
}

export interface AccessReviewSummary {
  id: number;
  performedAt: string;
  performedByEmail: string | null;
  reviewedCount: number;
  keptCount: number;
  revokedCount: number;
  notes: string | null;
}

export interface AccessReviewOverview {
  intervalDays: number;
  overdue: boolean;
  nextDueAt: string | null;
  lastReview: AccessReviewSummary | null;
  items: AccessReviewItem[];
}

export interface AccessReviewEntry {
  nombre: string;
  email: string | null;
  roleName: string;
  reasons: string;
  decision: AccessReviewDecision;
  comment: string | null;
}

export interface AccessReviewDetail {
  review: AccessReviewSummary;
  entries: AccessReviewEntry[];
}

export interface AccessReviewDecisionRequest {
  assignmentId: number;
  decision: AccessReviewDecision;
  comment?: string;
}

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
