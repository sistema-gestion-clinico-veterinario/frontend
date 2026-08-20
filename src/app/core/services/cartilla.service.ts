import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';
import {
  CartillaAplicacionRequest,
  CartillaAplicacionResponse,
  AplicacionPreventiva,
  TipoVacuna,
  TipoDesparasitante
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

  listarTiposVacuna(petId: number) {
    return this.http.get<ApiResponse<TipoVacuna[]>>(`${this.preventivosUrl}/pets/${petId}/vaccine-types`);
  }

  listarTiposDesparasitante(petId: number) {
    return this.http.get<ApiResponse<TipoDesparasitante[]>>(`${this.preventivosUrl}/pets/${petId}/deworming-products`);
  }

  crearTipoVacuna(request: { nombre: string; especie: string; periodicidadMesesSugerida?: number; precio: number }) {
    return this.http.post<ApiResponse<TipoVacuna>>(`${this.preventivosUrl}/vaccine-types`, request);
  }

  crearTipoDesparasitante(request: { nombre: string; especie: string; periodicidadMesesSugerida?: number; precio: number }) {
    return this.http.post<ApiResponse<TipoDesparasitante>>(`${this.preventivosUrl}/deworming-products`, request);
  }
}