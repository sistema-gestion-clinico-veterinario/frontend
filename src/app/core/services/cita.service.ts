import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { CitaReprogramacionRequest, CitaRequest } from '../../models/request/cita-request';
import { CitaResponse } from '../../models/response/cita-response';
import { Page } from '../../models/response/page';
import { ApiResponse } from '../../models/response/api-response';
import { EstadoCita } from '../enums/estado-cita.enum';
import { RecordatorioWhatsAppResponse } from '../../models/response/recordatorio-whatsapp-response';

export interface AgendaCounters {
  programadas: number;
  enProceso: number;
  completadas: number;
  canceladas: number;
}

@Injectable({
  providedIn: 'root'
})
export class CitaService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/appointments`;

  listar(
    companyId?: number,
    fecha?: string,
    estado?: EstadoCita,
    veterinarioId?: number,
    page: number = 0,
    size: number = 10,
    fechaDesde?: string,
    fechaHasta?: string
  ) {
    let query = `?page=${page}&size=${size}`;
    if (companyId !== undefined && companyId !== null) query += `&companyId=${companyId}`;
    if (fecha) query += `&fecha=${fecha}`;
    if (fechaDesde) query += `&fechaDesde=${fechaDesde}`;
    if (fechaHasta) query += `&fechaHasta=${fechaHasta}`;
    if (estado) query += `&estado=${estado}`;
    if (veterinarioId) query += `&veterinarioId=${veterinarioId}`;
    
    return this.http.get<ApiResponse<Page<CitaResponse>>>(`${this.apiUrl}${query}`);
  }

  obtenerContadores(
    companyId: number,
    fechaDesde?: string,
    fechaHasta?: string,
    veterinarioId?: number
  ) {
    let query = `?companyId=${companyId}`;
    if (fechaDesde) query += `&fechaDesde=${fechaDesde}`;
    if (fechaHasta) query += `&fechaHasta=${fechaHasta}`;
    if (veterinarioId) query += `&veterinarioId=${veterinarioId}`;
    return this.http.get<ApiResponse<AgendaCounters>>(`${this.apiUrl}/counters${query}`);
  }

  crear(data: CitaRequest) {
    return this.http.post<ApiResponse<CitaResponse>>(this.apiUrl, data);
  }

  actualizar(id: number, data: CitaRequest) {
    return this.http.put<ApiResponse<CitaResponse>>(`${this.apiUrl}/${id}`, data);
  }

  iniciarAtencion(id: number) {
    return this.http.patch<ApiResponse<number | null>>(`${this.apiUrl}/${id}/start`, {});
  }

  finalizarServicio(id: number, notas?: string) {
    return this.http.patch<ApiResponse<CitaResponse>>(`${this.apiUrl}/${id}/finish-service`, { notas });
  }

  cancelarCita(id: number, motivo: string) {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${id}/cancel?motivo=${encodeURIComponent(motivo)}`);
  }

  eliminarCita(id: number) {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${id}`);
  }

  reprogramar(id: number, data: CitaReprogramacionRequest) {
    return this.http.patch<ApiResponse<CitaResponse>>(`${this.apiUrl}/${id}/reschedule`, data);
  }

  getAdminDisponibilidad(empleadoId: number, fecha: string, servicioId: number, esEmergencia?: boolean, excludeCitaId?: number) {
    let url = `${this.apiUrl}/availability?empleadoId=${empleadoId}&fecha=${fecha}&servicioId=${servicioId}`;
    if (esEmergencia) url += `&esEmergencia=true`;
    if (excludeCitaId !== undefined) url += `&excludeCitaId=${excludeCitaId}`;
    return this.http.get<ApiResponse<string[]>>(url);
  }

  getServiciosNoMedicos(mascotaId: number) {
    return this.http.get<ApiResponse<CitaResponse[]>>(`${this.apiUrl}/mascota/${mascotaId}/servicios`);
  }

  listarRecordatoriosWhatsApp() {
    return this.http.get<ApiResponse<RecordatorioWhatsAppResponse[]>>(`${this.apiUrl}/reminders/whatsapp`);
  }
}
