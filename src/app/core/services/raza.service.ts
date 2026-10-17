import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { RazaResponse } from '../../models/response/raza-response';
import { RazaRequest } from '../../models/request/raza-request';
import { ApiResponse } from '../../models/response/api-response';
import { tap } from 'rxjs';
import { TimedRequestCache } from '../utils/timed-request-cache';

@Injectable({
  providedIn: 'root'
})
export class RazaService {
  private readonly http    = inject(HttpClient);
  private readonly apiUrl  = `${environment.apiUrl}/breeds`;
  private readonly cache = new TimedRequestCache(5 * 60 * 1000);

  listarPorEspecie(especie?: string, companyId?: number) {
    const params: string[] = [];
    if (especie) params.push(`especie=${especie}`);
    if (companyId != null) params.push(`companyId=${companyId}`);
    const query = params.length ? `?${params.join('&')}` : '';
    const request = () => this.http.get<ApiResponse<RazaResponse[]>>(`${this.apiUrl}${query}`);

    if (companyId == null) return request();
    return this.cache.get(`${companyId}:${especie ?? 'ALL'}`, request);
  }

  crear(data: RazaRequest, companyId: number) {
    return this.http.post<ApiResponse<RazaResponse>>(`${this.apiUrl}?companyId=${companyId}`, data).pipe(
      tap(() => this.cache.clear())
    );
  }
}
