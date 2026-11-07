import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { CompanyDTO } from '../../models/request/company-dto';
import { CompanyListResponse } from '../../models/response/company-list-response';
import { Page } from '../../models/response/page';
import { ApiResponse } from '../../models/response/api-response';
import { CompanyBrandingResponse, CompanySearchResult } from '../../models/response/company-public-response';
import { SKIP_GLOBAL_LOADING } from '../interceptors/api.interceptor';

@Injectable({
  providedIn: 'root'
})
export class CompanyService {
  private static readonly MAX_PAGE_SIZE = 100;
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/admin/company`;

  getCompany() {
    return this.http.get<ApiResponse<CompanyDTO>>(this.apiUrl);
  }

  listar(page: number = 0, size: number = 10) {
    const safePage = Math.max(0, Math.trunc(Number.isFinite(page) ? page : 0));
    const safeSize = Math.min(
      CompanyService.MAX_PAGE_SIZE,
      Math.max(1, Math.trunc(Number.isFinite(size) ? size : 10))
    );
    return this.http.get<ApiResponse<Page<CompanyListResponse>>>(`${this.apiUrl}/list`, {
      params: { page: safePage, size: safeSize }
    });
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

  getBrandingBySlug(slug: string) {
    return this.http.get<ApiResponse<CompanyBrandingResponse>>(
      `${environment.apiUrl}/company/branding/${slug}`
    );
  }

  searchByName(query: string) {
    return this.http.get<ApiResponse<CompanySearchResult[]>>(
      `${environment.apiUrl}/company/search`,
      { params: { q: query }, context: new HttpContext().set(SKIP_GLOBAL_LOADING, true) }
    );
  }
}
