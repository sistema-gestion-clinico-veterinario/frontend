import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { CompanyDTO } from '../../models/request/company-dto';
import { CompanyListResponse } from '../../models/response/company-list-response';
import { Page } from '../../models/response/page';
import { ApiResponse } from '../../models/response/api-response';

@Injectable({
  providedIn: 'root'
})
export class CompanyService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/admin/company`;

  getCompany() {
    return this.http.get<ApiResponse<CompanyDTO>>(this.apiUrl);
  }

  listar(page: number = 0, size: number = 10) {
    return this.http.get<ApiResponse<Page<CompanyListResponse>>>(`${this.apiUrl}/list?page=${page}&size=${size}`);
  }

  getById(id: number) {
    return this.http.get<ApiResponse<CompanyDTO>>(`${this.apiUrl}/${id}`);
  }

  saveCompany(company: CompanyDTO) {
    return this.http.post<ApiResponse<CompanyDTO>>(this.apiUrl, company);
  }

  updateCompany(company: CompanyDTO) {
    return this.http.put<ApiResponse<CompanyDTO>>(`${this.apiUrl}/${company.id}`, company);
  }

  toggleActivo(id: number) {
    return this.http.patch<ApiResponse<CompanyListResponse>>(`${this.apiUrl}/${id}/toggle-active`, {});
  }

  /** Publico, sin autenticacion - pinta el login antes de iniciar sesion. */
  getBrandingBySlug(slug: string) {
    return this.http.get<ApiResponse<CompanyBrandingResponse>>(
      `${environment.apiUrl}/company/branding/${slug}`
    );
  }

  /** Publico, sin autenticacion - buscador de clinica para el login sin slug. */
  searchByName(query: string) {
    return this.http.get<ApiResponse<CompanySearchResult[]>>(
      `${environment.apiUrl}/company/search`,
      { params: { q: query } }
    );
  }
}

export interface CompanyBrandingResponse {
  name: string;
  logoUrl: string | null;
  colorPrimario: string | null;
}

export interface CompanySearchResult {
  name: string;
  slug: string;
  logoUrl: string | null;
}
