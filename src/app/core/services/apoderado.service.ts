import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiResponse } from '../../models/response/api-response';
import { Page } from '../../models/response/page';
import { ApoderadoListResponse } from '../../models/response/apoderado-list-response';
import { ApoderadoRequest } from '../../models/request/apoderado-request';
import { UserProfileDTO } from '../../models/response/user-profile-dto';

@Injectable({
  providedIn: 'root'
})
export class ApoderadoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8080/api/v1/clientes/apoderados';

  listar(companyId?: number, nombre?: string, numeroDocumento?: string, page: number = 0, size: number = 10) {
    let params = `?page=${page}&size=${size}`;
    if (companyId !== undefined && companyId !== null) {
      params += `&companyId=${companyId}`;
    }
    if (nombre) params += `&nombre=${nombre}`;
    if (numeroDocumento) params += `&numeroDocumento=${numeroDocumento}`;
    return this.http.get<ApiResponse<Page<ApoderadoListResponse>>>(`${this.apiUrl}${params}`);
  }

  getById(id: number) {
    return this.http.get<ApiResponse<ApoderadoRequest>>(`${this.apiUrl}/${id}`);
  }

  registrar(data: ApoderadoRequest) {
    return this.http.post<ApiResponse<UserProfileDTO>>(this.apiUrl, data);
  }

  actualizar(id: number, data: ApoderadoRequest) {
    return this.http.put<ApiResponse<UserProfileDTO>>(`${this.apiUrl}/${id}`, data);
  }

  cambiarEstado(id: number, active: boolean) {
    return this.http.patch<ApiResponse<void>>(`${this.apiUrl}/${id}/status?active=${active}`, {});
  }
}
