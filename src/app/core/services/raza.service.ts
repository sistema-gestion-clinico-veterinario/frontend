import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { RazaResponse } from '../../models/response/raza-response';
import { RazaRequest } from '../../models/request/raza-request';
import { ApiResponse } from '../../models/response/api-response';

@Injectable({
  providedIn: 'root'
})
export class RazaService {
  private readonly http    = inject(HttpClient);
  private readonly apiUrl  = `${environment.apiUrl}/breeds`;

  listarPorEspecie(especie?: string) {
    let query = especie ? `?especie=${especie}` : '';
    return this.http.get<ApiResponse<RazaResponse[]>>(`${this.apiUrl}${query}`);
  }

  crear(data: RazaRequest) {
    return this.http.post<ApiResponse<RazaResponse>>(this.apiUrl, data);
  }
}
