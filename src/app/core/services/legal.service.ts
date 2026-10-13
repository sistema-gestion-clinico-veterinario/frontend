import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';
import { LegalAcceptanceDTO, LegalDocumentDTO, LegalStatusDTO } from '../../models/legal/legal.model';

@Injectable({ providedIn: 'root' })
export class LegalService {
  private readonly baseUrl = `${environment.apiUrl}/legal`;

  constructor(private http: HttpClient) {}

  getCurrentDocuments(): Observable<ApiResponse<LegalDocumentDTO[]>> {
    return this.http.get<ApiResponse<LegalDocumentDTO[]>>(`${this.baseUrl}/current`);
  }

  getStatus(): Observable<ApiResponse<LegalStatusDTO>> {
    return this.http.get<ApiResponse<LegalStatusDTO>>(`${this.baseUrl}/status`);
  }

  getMyAcceptances(): Observable<ApiResponse<LegalAcceptanceDTO[]>> {
    return this.http.get<ApiResponse<LegalAcceptanceDTO[]>>(`${this.baseUrl}/my-acceptances`);
  }

  accept(legalDocumentIds: number[]): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/accept`, { legalDocumentIds });
  }
}
