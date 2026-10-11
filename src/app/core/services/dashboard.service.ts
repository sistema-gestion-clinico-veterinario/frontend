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

export interface DashboardAuditSummary {
  id: number;
  timestamp: string;
  userRole?: string;
  companyName?: string;
  action: string;
  module: string;
}

export interface DashboardEmployeeSummary {
  id: number;
  nombre: string;
  apellido: string;
  activo: boolean;
  tiposEmpleado?: string[];
  especialidades?: string[];
}

export interface DashboardGuardianSummary {
  id: number;
  nombre: string;
  apellido: string;
  activo: boolean;
}

export interface DashboardAppointmentSummary {
  id: number;
  veterinarioId?: number;
  servicioNombre?: string;
  fechaHoraInicio: string;
  fechaHoraFin: string;
  estado: string;
}

export interface DashboardPetSummary {
  id: number;
  nombreCompleto: string;
  especie: string;
  raza?: string;
}

export interface DashboardPaymentSummary {
  id: number;
  metodoPago: string;
  monto: number;
  fechaPago: string;
  estado: string;
  mascotaNombre?: string;
  servicioNombre?: string;
}

export interface DashboardCompanySummary {
  id: number;
  name: string;
  activo: boolean;
}

export interface DashboardOverview {
  stats: DashboardStats;
  recentLogs: DashboardAuditSummary[];
  employees: DashboardEmployeeSummary[];
  todayAppointments: DashboardAppointmentSummary[];
  pets: DashboardPetSummary[];
  roles: any[];
  guardians: DashboardGuardianSummary[];
  schedules: any[];
  payments: DashboardPaymentSummary[];
  companies: DashboardCompanySummary[];
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
