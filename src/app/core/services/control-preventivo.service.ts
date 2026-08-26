import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';
import { Page } from '../../models/response/page';
import { AplicacionPreventivaResponse, ControlPreventivoResponse, TipoControlPreventivo, TipoVacunaResponse } from '../../models/response/control-preventivo-response';

export interface RegistroVacunacionPayload {
  controlPreventivoId?: number;
  tipoVacunaId: number;
  fechaAplicacion: string;
  periodicidadMeses: number;
  fechaProximaDosis?: string;
}

export interface RegistroDesparasitacionPayload {
  controlPreventivoId?: number;
  producto: string;
  fechaAplicacion: string;
  periodicidadMeses: number;
  fechaProximaAplicacion?: string;
}

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

  crearTipoDesparasitante(request: { nombre: string; especie: string; precio?: number; periodicidadMesesSugerida?: number }) {
    return this.http.post<ApiResponse<any>>(`${this.baseUrl}/deworming-products`, request);
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

  reprogramar(controlId: number, fechaRecomendada: string) {
    return this.http.put<ApiResponse<ControlPreventivoResponse>>(`${this.baseUrl}/${controlId}/schedule`, { fechaRecomendada });
  }

  cancelar(controlId: number) {
    return this.http.patch<ApiResponse<ControlPreventivoResponse>>(`${this.baseUrl}/${controlId}/cancel`, {});
  }

  registrarVacunacion(consultaId: number, request: RegistroVacunacionPayload) {
    return this.http.post<ApiResponse<ControlPreventivoResponse>>(`${this.baseUrl}/consultations/${consultaId}/vaccinations`, request);
  }

  registrarDesparasitacion(consultaId: number, request: RegistroDesparasitacionPayload) {
    return this.http.post<ApiResponse<ControlPreventivoResponse>>(`${this.baseUrl}/consultations/${consultaId}/dewormings`, request);
  }

  listarTiposVacunaPorCompany(page: number = 0, size: number = 10) {
    return this.http.get<ApiResponse<Page<TipoVacunaResponse>>>(`${this.baseUrl}/company/vaccine-types?page=${page}&size=${size}`);
  }

  listarTiposDesparasitantePorCompany(page: number = 0, size: number = 10) {
    return this.http.get<ApiResponse<Page<any>>>(`${this.baseUrl}/company/deworming-products?page=${page}&size=${size}`);
  }

  actualizarTipoVacuna(id: number, request: any) {
    return this.http.put<ApiResponse<TipoVacunaResponse>>(`${this.baseUrl}/vaccine-types/${id}`, request);
  }

  actualizarTipoDesparasitante(id: number, request: any) {
    return this.http.put<ApiResponse<any>>(`${this.baseUrl}/deworming-products/${id}`, request);
  }

  cambiarEstadoTipoVacuna(id: number, activo: boolean) {
    return this.http.patch<ApiResponse<void>>(`${this.baseUrl}/vaccine-types/${id}/status?activo=${activo}`, {});
  }

  cambiarEstadoTipoDesparasitante(id: number, activo: boolean) {
    return this.http.patch<ApiResponse<void>>(`${this.baseUrl}/deworming-products/${id}/status?activo=${activo}`, {});
  }

  eliminarTipoVacuna(id: number) {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/vaccine-types/${id}`);
  }

  eliminarTipoDesparasitante(id: number) {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/deworming-products/${id}`);
  }
}
