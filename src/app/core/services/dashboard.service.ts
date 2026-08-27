import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';

export interface DashboardStats {
  totalPacientes: number;
  totalCitasHoy: number;
  totalCitas: number;
  totalEmpleados: number;
  totalEmpresas?: number;
  citasPorDia?: number[];
  citasPorSemana?: number[];
  citasPorMes?: number[];
}

export interface DashboardOverview {
  stats: DashboardStats;
  recentLogs: any[];
  employees: any[];
  todayAppointments: any[];
  pets: any[];
  roles: any[];
  guardians: any[];
  schedules: any[];
  payments: any[];
  companies: any[];
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

  getOverview(companyId?: number) {
    const params = companyId ? `?companyId=${companyId}` : '';
    return this.http.get<ApiResponse<DashboardOverview>>(`${this.apiUrl}/overview${params}`);
  }
}
