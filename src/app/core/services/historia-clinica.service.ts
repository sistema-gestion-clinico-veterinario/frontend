import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { HistoriaClinicaDetalle } from '../../models/response/historia-clinica-response';
import { ConsultaResponse } from '../../models/response/consulta-response';
import { ConsultaRequest, CerrarConsultaRequest } from '../../models/request/consulta-request';
import { ApiResponse } from '../../models/response/api-response';

@Injectable({
  providedIn: 'root'
})
export class HistoriaClinicaService {
  private readonly http     = inject(HttpClient);
  private readonly hcUrl    = `${environment.apiUrl}/historias-clinicas`;
  private readonly citasUrl = `${environment.apiUrl}/consultas`;

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
}
