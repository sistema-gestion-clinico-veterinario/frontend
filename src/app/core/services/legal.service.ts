import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';

export interface LegalDocumentDTO {
  id: number;
  tipo: 'TERMINOS_Y_CONDICIONES' | 'POLITICA_PRIVACIDAD';
  version: string;
  contenido: string;
  vigenteDesde: string;
}

export interface LegalStatusDTO {
  needsAcceptance: boolean;
  overdue: boolean;
  pendingDocuments: LegalDocumentDTO[];
}

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

  accept(legalDocumentIds: number[]): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/accept`, { legalDocumentIds });
  }
}
