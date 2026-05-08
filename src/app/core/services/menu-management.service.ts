import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';
import { Menu } from '../../models/response/auth-login-response.model';

@Injectable({
  providedIn: 'root'
})
export class MenuManagementService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/admin/menus`;

  listar() {
    return this.http.get<ApiResponse<Menu[]>>(this.apiUrl);
  }

  listarTodo() {
    return this.http.get<ApiResponse<Menu[]>>(`${this.apiUrl}/all`);
  }

  crear(data: Partial<Menu>) {
    return this.http.post<ApiResponse<Menu>>(this.apiUrl, data);
  }

  actualizar(id: number, data: Partial<Menu>) {
    return this.http.put<ApiResponse<Menu>>(`${this.apiUrl}/${id}`, data);
  }

  eliminar(id: number) {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${id}`);
  }
}
