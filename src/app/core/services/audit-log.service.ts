import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Page } from '../../models/response/page';
import { ApiResponse } from '../../models/response/api-response';

export interface AuditLog {
  id: number;
  timestamp: string;
  userEmail: string;
  userRole: string;
  companyId: number;
  companyName: string;
  action: string;
  module: string;
  details: string;
  ipAddress: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuditLogService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/admin/audit-logs`;

  getLogs(filters: {
    companyId?: number;
    userEmail?: string;
    action?: string;
    module?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    size?: number;
    sort?: string;
  }) {
    let params = new HttpParams();
    
    if (filters.companyId !== undefined && filters.companyId !== null) {
      params = params.set('companyId', filters.companyId.toString());
    }
    if (filters.userEmail) {
      params = params.set('userEmail', filters.userEmail);
    }
    if (filters.action) {
      params = params.set('action', filters.action);
    }
    if (filters.module) {
      params = params.set('module', filters.module);
    }
    if (filters.startDate) {
      params = params.set('startDate', filters.startDate);
    }
    if (filters.endDate) {
      params = params.set('endDate', filters.endDate);
    }
    if (filters.page !== undefined) {
      params = params.set('page', filters.page.toString());
    }
    if (filters.size !== undefined) {
      params = params.set('size', filters.size.toString());
    }
    if (filters.sort) {
      params = params.set('sort', filters.sort);
    }

    return this.http.get<ApiResponse<Page<AuditLog>>>(this.apiUrl, { params });
  }
}
