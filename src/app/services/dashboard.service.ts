import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { ApiResponse } from '../models/response/api-response';

export interface DashboardStats {
  totalPacientes: number;
  totalCitasHoy: number;
  totalCitas: number;
  totalEmpleados: number;
  totalEmpresas?: number;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/dashboard`;

  getStats(companyId?: number) {
    const params = companyId ? `?companyId=${companyId}` : '';
    return this.http.get<ApiResponse<DashboardStats>>(`${this.apiUrl}/stats${params}`);
  }
}
