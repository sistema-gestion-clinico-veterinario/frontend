import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';
import { Page } from '../../models/response/page';
import { MascotaCartillaResponse } from '../../models/response/mascota-cartilla-response';
import { SKIP_GLOBAL_LOADING } from '../interceptors/api.interceptor';
import {
  CartillaAplicacionRequest,
  CartillaAplicacionResponse,
  AplicacionPreventiva,
  TipoVacuna,
  TipoDesparasitante,
  RecordatorioWhatsApp
} from '../../models/cartilla.model';

@Injectable({ providedIn: 'root' })
export class CartillaService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/cartilla`;
  private readonly preventivosUrl = `${environment.apiUrl}/preventive-controls`;

  registrarVacunacion(req: CartillaAplicacionRequest) {
    return this.http.post<ApiResponse<CartillaAplicacionResponse>>(`${this.url}/vaccinations`, req);
  }

  registrarDesparasitacion(req: CartillaAplicacionRequest) {
    return this.http.post<ApiResponse<CartillaAplicacionResponse>>(`${this.url}/dewormings`, req);
  }

  obtenerMatriz(petId: number) {
    return this.http.get<ApiResponse<AplicacionPreventiva[]>>(`${this.url}/pets/${petId}`);
  }

  listarMascotasConCartilla(especie?: string, page: number = 0, size: number = 10) {
    let query = `?page=${page}&size=${size}`;
    if (especie) query += `&especie=${especie}`;
    const context = new HttpContext().set(SKIP_GLOBAL_LOADING, true);
    return this.http.get<ApiResponse<Page<MascotaCartillaResponse>>>(`${this.url}/pets${query}`, { context });
  }

  editarVacunacion(id: number, request: any) {
    return this.http.put<ApiResponse<CartillaAplicacionResponse>>(`${this.url}/vaccinations/${id}`, request);
  }

  editarDesparasitacion(id: number, request: any) {
    return this.http.put<ApiResponse<CartillaAplicacionResponse>>(`${this.url}/dewormings/${id}`, request);
  }

  cambiarEstadoVacunacion(id: number, activo: boolean) {
    return this.http.patch<ApiResponse<void>>(`${this.url}/vaccinations/${id}/status?activo=${activo}`, {});
  }

  cambiarEstadoDesparasitacion(id: number, activo: boolean) {
    return this.http.patch<ApiResponse<void>>(`${this.url}/dewormings/${id}/status?activo=${activo}`, {});
  }

  listarTiposVacuna(petId: number) {
    return this.http.get<ApiResponse<TipoVacuna[]>>(`${this.preventivosUrl}/pets/${petId}/vaccine-types`);
  }

  listarTiposDesparasitante(petId: number) {
    return this.http.get<ApiResponse<TipoDesparasitante[]>>(`${this.preventivosUrl}/pets/${petId}/deworming-products`);
  }

  crearTipoVacuna(request: { nombre: string; especie: string; periodicidadMesesSugerida?: number; precio: number; lote?: string; fechaVencimientoProducto?: string; dosis?: number; unidadDosis?: string; viaAdministracion?: string }) {
    return this.http.post<ApiResponse<TipoVacuna>>(`${this.preventivosUrl}/vaccine-types`, request);
  }

  crearTipoDesparasitante(request: { nombre: string; especie: string; periodicidadMesesSugerida?: number; precio: number; lote?: string; fechaVencimientoProducto?: string; dosis?: number; unidadDosis?: string; viaAdministracion?: string }) {
    return this.http.post<ApiResponse<TipoDesparasitante>>(`${this.preventivosUrl}/deworming-products`, request);
  }

  listarRecordatoriosWhatsApp() {
    return this.http.get<ApiResponse<RecordatorioWhatsApp[]>>(`${this.url}/recordatorios-whatsapp`);
  }
}
