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

  listarPorEspecie(especie?: string, companyId?: number) {
    const params: string[] = [];
    if (especie) params.push(`especie=${especie}`);
    if (companyId != null) params.push(`companyId=${companyId}`);
    const query = params.length ? `?${params.join('&')}` : '';
    return this.http.get<ApiResponse<RazaResponse[]>>(`${this.apiUrl}${query}`);
  }

  crear(data: RazaRequest, companyId: number) {
    return this.http.post<ApiResponse<RazaResponse>>(`${this.apiUrl}?companyId=${companyId}`, data);
  }
}
