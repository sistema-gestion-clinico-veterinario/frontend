import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';
import { Page } from '../../models/response/page';
import { MascotaCartillaResponse } from '../../models/response/mascota-cartilla-response';
import { SKIP_GLOBAL_LOADING } from '../interceptors/api.interceptor';
import { CartillaAplicacionRequest, CartillaAplicacionResponse, AplicacionPreventiva, TipoVacuna, CartillaDetalle } from '../../models/cartilla.model';

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

  obtenerDetalle(petId: number) {
    return this.http.get<ApiResponse<CartillaDetalle>>(`${this.url}/pets/${petId}/detail`);
  }

  listarMascotasConCartilla(companyId?: number, especie?: string, page: number = 0, size: number = 10) {
    let query = `?page=${page}&size=${size}`;
    if (companyId != null) query += `&companyId=${companyId}`;
    if (especie) query += `&especie=${especie}`;
    const context = new HttpContext().set(SKIP_GLOBAL_LOADING, true);
    return this.http.get<ApiResponse<Page<MascotaCartillaResponse>>>(`${this.url}/pets${query}`, { context });
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

}
