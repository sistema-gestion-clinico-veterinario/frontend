import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';
import { Page } from '../../models/response/page';

@Injectable({
  providedIn: 'root'
})
export class TipoEmpleadoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/admin/tipos-empleado`;

  listar(companyId?: number) {
    const params = companyId ? `?companyId=${companyId}&size=1000` : '?size=1000';
    return this.http.get<ApiResponse<Page<any>>>(`${this.apiUrl}${params}`);
  }

  crear(data: { nombre: string; descripcion?: string; permiteEspecialidades?: boolean; company?: { id: number } }) {
    return this.http.post<ApiResponse<any>>(this.apiUrl, data);
  }

  eliminar(id: number) {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${id}`);
  }
}
