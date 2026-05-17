import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApiResponse } from '../../models/response/api-response';
import { EmpleadoListResponse } from '../../models/response/empleado-list-response';
import { EmpleadoRequest } from '../../models/request/empleado-request';
import { HorarioEmpleadoResponse } from '../../models/response/horario-empleado-response';
import { UserProfileDTO } from '../../models/response/user-profile-dto';
import { environment } from '../../../environments/environment';
import { Page } from '../../models/response/page';

@Injectable({
  providedIn: 'root'
})
export class EmpleadoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/admin/empleados`;

  listar(companyId?: number, nombre?: string, page: number = 0, size: number = 10) {
    let params = `?page=${page}&size=${size}`;
    if (companyId !== undefined && companyId !== null) {
      params += `&companyId=${companyId}`;
    }
    if (nombre) params += `&nombre=${nombre}`;
    return this.http.get<ApiResponse<Page<EmpleadoListResponse>>>(`${this.apiUrl}${params}`);
  }

  getById(id: number) {
    return this.http.get<ApiResponse<EmpleadoRequest>>(`${this.apiUrl}/${id}`);
  }

  registrar(empleado: EmpleadoRequest) {
    return this.http.post<ApiResponse<UserProfileDTO>>(this.apiUrl, empleado);
  }

  actualizar(id: number, empleado: EmpleadoRequest) {
    return this.http.put<ApiResponse<UserProfileDTO>>(`${this.apiUrl}/${id}`, empleado);
  }

  cambiarEstado(id: number, activo: boolean) {
    return this.http.patch<ApiResponse<void>>(`${this.apiUrl}/${id}/status?active=${activo}`, {});
  }

  eliminar(id: number) {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${id}`);
  }

  assignBulkSchedule(empleadoId: number, request: any): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.apiUrl}/${empleadoId}/schedule-bulk`, request);
  }

  getHorario(id: number) {
    return this.http.get<ApiResponse<HorarioEmpleadoResponse[]>>(`${this.apiUrl}/${id}/horario`);
  }

  deleteHorario(horarioId: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/horario/${horarioId}`);
  }

  updateHorario(horarioId: number, request: any): Observable<ApiResponse<void>> {
    return this.http.put<ApiResponse<void>>(`${this.apiUrl}/horario/${horarioId}`, request);
  }

  cloneWeek(empleadoId: number, sourceWeekStart: string, targetWeekStart: string): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.apiUrl}/${empleadoId}/clone-week?sourceWeekStart=${sourceWeekStart}&targetWeekStart=${targetWeekStart}`, {});
  }

  cloneDay(empleadoId: number, sourceDate: string, targetDate: string): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.apiUrl}/${empleadoId}/clone-day?sourceDate=${sourceDate}&targetDate=${targetDate}`, {});
  }

  getSchedulesReport(companyId?: number): Observable<ApiResponse<any[]>> {
    const params = companyId ? `?companyId=${companyId}` : '';
    return this.http.get<ApiResponse<any[]>>(`${this.apiUrl}/schedules-report${params}`);
  }
}
