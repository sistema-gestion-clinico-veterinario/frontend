import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { HistoriaClinicaDetalle } from '../../models/response/historia-clinica-response';
import { ConsultaResponse } from '../../models/response/consulta-response';
import { ConsultaRequest, CerrarConsultaRequest } from '../../models/request/consulta-request';
import { PrescripcionRequest } from '../../models/request/prescripcion-request';
import { PrescripcionResponse } from '../../models/response/prescripcion-response';
import { Page } from '../../models/response/page';
import { ApiResponse } from '../../models/response/api-response';

@Injectable({
  providedIn: 'root'
})
export class HistoriaClinicaService {
  private readonly http            = inject(HttpClient);
  private readonly hcUrl           = `${environment.apiUrl}/historias-clinicas`;
  private readonly citasUrl        = `${environment.apiUrl}/consultas`;
  private readonly recetasUrl      = `${environment.apiUrl}/prescripciones`;

  buscar(query: { numeroHc?: string; nombrePaciente?: string; nombrePropietario?: string; page?: number; size?: number }) {
    let params = `?page=${query.page || 0}&size=${query.size || 10}`;
    if (query.numeroHc) params += `&numeroHc=${query.numeroHc}`;
    if (query.nombrePaciente) params += `&nombrePaciente=${query.nombrePaciente}`;
    if (query.nombrePropietario) params += `&nombrePropietario=${query.nombrePropietario}`;
    
    return this.http.get<ApiResponse<Page<any>>>(`${this.hcUrl}${params}`);
  }

  getPorMascota(mascotaId: number) {
    return this.http.get<ApiResponse<HistoriaClinicaDetalle>>(`${this.hcUrl}/mascota/${mascotaId}`);
  }

  getConsulta(consultaId: number) {
    return this.http.get<ApiResponse<ConsultaResponse>>(`${this.citasUrl}/${consultaId}`);
  }

  updateConsulta(consultaId: number, request: ConsultaRequest) {
    return this.http.put<ApiResponse<ConsultaResponse>>(`${this.citasUrl}/${consultaId}`, request);
  }

  cerrarConsulta(consultaId: number, request: CerrarConsultaRequest) {
    return this.http.patch<ApiResponse<ConsultaResponse>>(`${this.citasUrl}/${consultaId}/cerrar`, request);
  }

  crearReceta(consultaId: number, request: PrescripcionRequest) {
    return this.http.post<ApiResponse<PrescripcionResponse>>(`${this.recetasUrl}/consulta/${consultaId}`, request);
  }

  listarRecetas(consultaId: number) {
    return this.http.get<ApiResponse<PrescripcionResponse[]>>(`${this.recetasUrl}/consulta/${consultaId}`);
  }

  actualizarReceta(id: number, request: PrescripcionRequest) {
    return this.http.put<ApiResponse<PrescripcionResponse>>(`${this.recetasUrl}/${id}`, request);
  }

  eliminarReceta(id: number) {
    return this.http.delete<ApiResponse<void>>(`${this.recetasUrl}/${id}`);
  }
}
