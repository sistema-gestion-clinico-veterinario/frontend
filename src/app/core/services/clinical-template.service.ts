import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';
import {
  ClinicalConcept,
  ClinicalConceptRequest,
  ClinicalTemplateCreateRequest,
  ClinicalTemplateDraftRequest,
  ClinicalTemplateResponse,
  ClinicalTemplateSummary
} from '../../models/clinical-template';

@Injectable({ providedIn: 'root' })
export class ClinicalTemplateService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/clinical-templates`;

  get(id: number) {
    return this.http.get<ApiResponse<ClinicalTemplateResponse>>(`${this.url}/${id}`);
  }

  current(species?: string, serviceId?: number) {
    let params = new HttpParams();
    if (species) params = params.set('species', species);
    if (serviceId) params = params.set('serviceId', serviceId);
    return this.http.get<ApiResponse<ClinicalTemplateResponse>>(`${this.url}/current`, { params });
  }

  list() {
    return this.http.get<ApiResponse<ClinicalTemplateSummary[]>>(this.url);
  }

  concepts() {
    return this.http.get<ApiResponse<ClinicalConcept[]>>(`${this.url}/concepts`);
  }

  createConcept(request: ClinicalConceptRequest) {
    return this.http.post<ApiResponse<ClinicalConcept>>(`${this.url}/concepts`, request);
  }

  createDraft() {
    return this.http.post<ApiResponse<ClinicalTemplateResponse>>(`${this.url}/drafts`, {});
  }

  create(request: ClinicalTemplateCreateRequest) {
    return this.http.post<ApiResponse<ClinicalTemplateResponse>>(this.url, request);
  }

  createDraftFrom(id: number) {
    return this.http.post<ApiResponse<ClinicalTemplateResponse>>(`${this.url}/${id}/drafts`, {});
  }

  makeDefault(id: number) {
    return this.http.post<ApiResponse<ClinicalTemplateResponse>>(`${this.url}/${id}/default`, {});
  }

  updateDraft(id: number, request: ClinicalTemplateDraftRequest) {
    return this.http.put<ApiResponse<ClinicalTemplateResponse>>(`${this.url}/drafts/${id}`, request);
  }

  publish(id: number) {
    return this.http.post<ApiResponse<ClinicalTemplateResponse>>(`${this.url}/drafts/${id}/publish`, {});
  }
}
