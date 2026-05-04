import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { ApiResponse } from '../models/response/api-response';

@Injectable({
  providedIn: 'root'
})
export class HttpApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  get<T>(uri: string) {
    return this.http.get<ApiResponse<T>>(`${this.baseUrl}${uri}`);
  }

  post<T>(uri: string, body: any) {
    return this.http.post<ApiResponse<T>>(`${this.baseUrl}${uri}`, body);
  }

  put<T>(uri: string, body: any) {
    return this.http.put<ApiResponse<T>>(`${this.baseUrl}${uri}`, body);
  }

  delete<T>(uri: string) {
    return this.http.delete<ApiResponse<T>>(`${this.baseUrl}${uri}`);
  }

  patch<T>(uri: string, body: any) {
    return this.http.patch<ApiResponse<T>>(`${this.baseUrl}${uri}`, body);
  }
}
