import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { CitaRequest } from '../../models/request/cita-request';
import { CitaResponse } from '../../models/response/cita-response';
import { Page } from '../../models/response/page';
import { ApiResponse } from '../../models/response/api-response';
import { EstadoCita } from '../enums/estado-cita.enum';

@Injectable({
  providedIn: 'root'
})
export class CitaService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/citas`;

  listar(companyId?: number, fecha?: string, estado?: EstadoCita, veterinarioId?: number, page: number = 0, size: number = 10) {
    let query = `?page=${page}&size=${size}`;
    if (companyId !== undefined && companyId !== null) query += `&companyId=${companyId}`;
    if (fecha) query += `&fecha=${fecha}`;
    if (estado) query += `&estado=${estado}`;
    if (veterinarioId) query += `&veterinarioId=${veterinarioId}`;
    
    return this.http.get<ApiResponse<Page<CitaResponse>>>(`${this.apiUrl}${query}`);
  }

  crear(data: CitaRequest) {
    return this.http.post<ApiResponse<CitaResponse>>(this.apiUrl, data);
  }

  actualizar(id: number, data: CitaRequest) {
    return this.http.put<ApiResponse<CitaResponse>>(`${this.apiUrl}/${id}`, data);
  }

  iniciarAtencion(id: number) {
    return this.http.patch<ApiResponse<number>>(`${this.apiUrl}/${id}/iniciar`, {});
  }

  cancelarCita(id: number, motivo: string) {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${id}/cancelar?motivo=${encodeURIComponent(motivo)}`);
  }

  eliminarCita(id: number) {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${id}`);
  }

  reprogramar(id: number, data: CitaRequest) {
    return this.http.put<ApiResponse<CitaResponse>>(`${this.apiUrl}/${id}/reprogramar`, data);
  }

  getAdminDisponibilidad(empleadoId: number, fecha: string, servicioId: number) {
    return this.http.get<ApiResponse<string[]>>(
      `${this.apiUrl}/disponibilidad?empleadoId=${empleadoId}&fecha=${fecha}&servicioId=${servicioId}`
    );
  }
}
