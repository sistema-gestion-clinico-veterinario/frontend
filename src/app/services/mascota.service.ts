import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { MascotaResponse } from '../models/response/mascota-response';
import { Page } from '../models/response/page';
import { ApiResponse } from '../models/response/api-response';

@Injectable({
  providedIn: 'root'
})
export class MascotaService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/mascotas`;

  listar(companyId?: number, nombre?: string, especie?: string, page: number = 0, size: number = 100) {
    let query = `?page=${page}&size=${size}`;
    if (companyId !== undefined && companyId !== null) query += `&companyId=${companyId}`;
    if (nombre) query += `&nombre=${nombre}`;
    if (especie) query += `&especie=${especie}`;
    
    return this.http.get<ApiResponse<Page<MascotaResponse>>>(`${this.apiUrl}${query}`);
  }
}
