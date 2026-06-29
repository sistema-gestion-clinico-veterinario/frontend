import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { MascotaResponse } from '../../models/response/mascota-response';
import { MascotaRequest } from '../../models/request/mascota-request';
import { Page } from '../../models/response/page';
import { ApiResponse } from '../../models/response/api-response';
import { SKIP_GLOBAL_LOADING } from '../interceptors/api.interceptor';

@Injectable({
  providedIn: 'root'
})
export class MascotaService {
  private readonly http    = inject(HttpClient);
  private readonly apiUrl  = `${environment.apiUrl}/pets`;

  listar(
    companyId?: number,
    nombre?:    string,
    especie?:   string,
    page:       number  = 0,
    size:       number  = 12,
    activo?:    boolean,
    skipLoading: boolean = false
  ) {
    let query = `?page=${page}&size=${size}`;
    if (companyId !== undefined && companyId !== null) query += `&companyId=${companyId}`;
    if (nombre)  query += `&nombre=${encodeURIComponent(nombre)}`;
    if (especie) query += `&especie=${especie}`;
    if (activo  !== undefined && activo !== null) query += `&activo=${activo}`;

    const context = skipLoading ? new HttpContext().set(SKIP_GLOBAL_LOADING, true) : undefined;
    return this.http.get<ApiResponse<Page<MascotaResponse>>>(`${this.apiUrl}${query}`, { context });
  }

  obtenerPorId(id: number) {
    return this.http.get<ApiResponse<MascotaResponse>>(`${this.apiUrl}/${id}`);
  }

  obtenerPorUuid(uuid: string) {
    return this.http.get<ApiResponse<MascotaResponse>>(`${this.apiUrl}/uuid/${uuid}`);
  }

  crear(data: MascotaRequest) {
    return this.http.post<ApiResponse<MascotaResponse>>(this.apiUrl, data);
  }

  actualizar(id: number, data: MascotaRequest) {
    return this.http.put<ApiResponse<MascotaResponse>>(`${this.apiUrl}/${id}`, data);
  }

  cambiarEstado(id: number, activo: boolean, motivoBaja?: string, otroMotivoBaja?: string) {
    const request = {
      active: activo,
      motivoBaja: motivoBaja,
      otroMotivoBaja: otroMotivoBaja
    };
    return this.http.patch<ApiResponse<void>>(`${this.apiUrl}/${id}/status`, request);
  }
}
