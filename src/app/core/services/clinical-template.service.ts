import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';
import {
  ClinicalConcept,
  ClinicalConceptRequest,
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

  current(species?: string) {
    const params = species ? new HttpParams().set('species', species) : undefined;
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

  updateDraft(id: number, request: ClinicalTemplateDraftRequest) {
    return this.http.put<ApiResponse<ClinicalTemplateResponse>>(`${this.url}/drafts/${id}`, request);
  }

  publish(id: number) {
    return this.http.post<ApiResponse<ClinicalTemplateResponse>>(`${this.url}/drafts/${id}/publish`, {});
  }
}
