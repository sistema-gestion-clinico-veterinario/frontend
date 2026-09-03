import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MenuStructureDTO } from '../../models/response/auth-login-response.model';
import { ApiResponse } from '../../models/response/api-response';

@Injectable({ providedIn: 'root' })
export class NavigationService {
  constructor(private readonly http: HttpClient) {}

  getEffectiveNavigation(): Observable<ApiResponse<MenuStructureDTO[]>> {
    return this.http.get<ApiResponse<MenuStructureDTO[]>>(`${environment.apiUrl}/me/navigation`);
  }
}
