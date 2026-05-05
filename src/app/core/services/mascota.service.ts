import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { MascotaResponse } from '../../models/response/mascota-response';
import { MascotaRequest } from '../../models/request/mascota-request';
import { Page } from '../../models/response/page';
import { ApiResponse } from '../../models/response/api-response';

@Injectable({
  providedIn: 'root'
})
export class MascotaService {
  private readonly http    = inject(HttpClient);
  private readonly apiUrl  = `${environment.apiUrl}/mascotas`;

  listar(
    companyId?: number,
    nombre?:    string,
    especie?:   string,
    page:       number  = 0,
    size:       number  = 12,
    activo?:    boolean
  ) {
    let query = `?page=${page}&size=${size}`;
    if (companyId !== undefined && companyId !== null) query += `&companyId=${companyId}`;
    if (nombre)  query += `&nombre=${encodeURIComponent(nombre)}`;
    if (especie) query += `&especie=${especie}`;
    if (activo  !== undefined && activo !== null) query += `&activo=${activo}`;
    return this.http.get<ApiResponse<Page<MascotaResponse>>>(`${this.apiUrl}${query}`);
  }

  crear(data: MascotaRequest) {
    return this.http.post<ApiResponse<MascotaResponse>>(this.apiUrl, data);
  }

  actualizar(id: number, data: MascotaRequest) {
    return this.http.put<ApiResponse<MascotaResponse>>(`${this.apiUrl}/${id}`, data);
  }

  cambiarEstado(id: number, activo: boolean) {
    return this.http.patch<ApiResponse<void>>(`${this.apiUrl}/${id}/status?activo=${activo}`, {});
  }
}
