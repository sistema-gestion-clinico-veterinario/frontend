import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';
import { ConfiguracionCumplimiento, ControlCumplimiento, EstadoCumplimientoClinica, ModoGestionCumplimiento } from '../../models/privacy/company-compliance.model';

@Injectable({ providedIn: 'root' })
export class CompanyComplianceService {
  private readonly http = inject(HttpClient);
  actuales(companyId: number) { return this.http.get<ApiResponse<ConfiguracionCumplimiento[]>>(`${environment.apiUrl}/platform/companies/${companyId}/compliance`); }
  historial(companyId: number) { return this.http.get<ApiResponse<ConfiguracionCumplimiento[]>>(`${environment.apiUrl}/platform/companies/${companyId}/compliance/history`); }
  actualesDeMiClinica() { return this.http.get<ApiResponse<EstadoCumplimientoClinica[]>>(`${environment.apiUrl}/me/compliance`); }
  configurar(companyId: number, control: ControlCumplimiento, body: { habilitado: boolean; modo: ModoGestionCumplimiento; bloqueante: boolean; justificacion: string; referenciaContractual: string | null; confirmoRevisionLegal: boolean; vigenteDesde: string | null }) {
    return this.http.post<ApiResponse<ConfiguracionCumplimiento>>(`${environment.apiUrl}/platform/companies/${companyId}/compliance/${control}`, body);
  }
}
