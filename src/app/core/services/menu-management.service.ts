import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';
import { MenuItemDTO } from '../../models/response/auth-login-response.model';

@Injectable({
  providedIn: 'root'
})
export class MenuManagementService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/admin/ventanas`;

  listar() {
    return this.http.get<ApiResponse<MenuItemDTO[]>>(this.apiUrl);
  }

  listarArbol() {
    return this.http.get<ApiResponse<MenuItemDTO[]>>(`${this.apiUrl}/arbol`);
  }

  listarArbolCompleto() {
    return this.http.get<ApiResponse<MenuItemDTO[]>>(`${this.apiUrl}/arbol/completo`);
  }

  crear(data: Partial<MenuItemDTO>) {
    return this.http.post<ApiResponse<MenuItemDTO>>(this.apiUrl, data);
  }

  actualizar(id: number, data: Partial<MenuItemDTO>) {
    return this.http.put<ApiResponse<MenuItemDTO>>(`${this.apiUrl}/${id}`, data);
  }

  eliminar(id: number) {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${id}`);
  }
}
