import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';
import { AplicacionPreventivaResponse, ControlPreventivoResponse, TipoControlPreventivo, TipoVacunaResponse } from '../../models/response/control-preventivo-response';

@Injectable({ providedIn: 'root' })
export class ControlPreventivoService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/preventive-controls`;

  listarTiposVacuna(mascotaId: number) {
    return this.http.get<ApiResponse<TipoVacunaResponse[]>>(`${this.baseUrl}/pets/${mascotaId}/vaccine-types`);
  }

  crearTipoVacuna(request: { nombre: string; especie: string; periodicidadMesesSugerida?: number }) {
    return this.http.post<ApiResponse<TipoVacunaResponse>>(`${this.baseUrl}/vaccine-types`, request);
  }

  listarControles(mascotaId: number) {
    return this.http.get<ApiResponse<ControlPreventivoResponse[]>>(`${this.baseUrl}/pets/${mascotaId}`);
  }

  listarAplicaciones(mascotaId: number) {
    return this.http.get<ApiResponse<AplicacionPreventivaResponse[]>>(`${this.baseUrl}/pets/${mascotaId}/applications`);
  }

  programar(mascotaId: number, request: { tipo: TipoControlPreventivo; tipoVacunaId?: number; nombreControl?: string; fechaRecomendada: string }) {
    return this.http.post<ApiResponse<ControlPreventivoResponse>>(`${this.baseUrl}/pets/${mascotaId}`, request);
  }

  registrarVacunacion(consultaId: number, request: { controlPreventivoId?: number; tipoVacunaId: number; fechaAplicacion: string; periodicidadMeses: number; fechaProximaDosis?: string }) {
    return this.http.post<ApiResponse<ControlPreventivoResponse>>(`${this.baseUrl}/consultations/${consultaId}/vaccinations`, request);
  }

  registrarDesparasitacion(consultaId: number, request: { controlPreventivoId?: number; producto: string; fechaAplicacion: string; periodicidadMeses: number; fechaProximaAplicacion?: string }) {
    return this.http.post<ApiResponse<ControlPreventivoResponse>>(`${this.baseUrl}/consultations/${consultaId}/dewormings`, request);
  }
}
