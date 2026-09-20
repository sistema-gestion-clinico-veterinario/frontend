import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Page } from '../../models/response/page';
import { ApiResponse } from '../../models/response/api-response';

export type TipoDescarga =
  | 'HORARIO_PDF'
  | 'HORARIO_EXCEL'
  | 'CARTILLA_VACUNACION'
  | 'CARTILLA_DESPARASITACION'
  | 'RECETA_PDF'
  | 'REPORTE_CLINICO_PDF'
  | 'REPORTE_CLINICO_EXCEL';

export interface AuditLog {
  id: number;
  timestamp: string;
  userEmail: string;
  userRole: string;
  companyId: number;
  companyName: string;
  action: string;
  module: string;
  details: string;
  ipAddress: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuditLogService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/admin/audit-logs`;

  getLogs(filters: {
    companyId?: number;
    userEmail?: string;
    action?: string;
    module?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    size?: number;
    sort?: string;
    initialLoad?: boolean;
  }) {
    let params = new HttpParams();
    
    if (filters.companyId !== undefined && filters.companyId !== null) {
      params = params.set('companyId', filters.companyId.toString());
    }
    if (filters.userEmail) {
      params = params.set('userEmail', filters.userEmail);
    }
    if (filters.action) {
      params = params.set('action', filters.action);
    }
    if (filters.module) {
      params = params.set('module', filters.module);
    }
    if (filters.startDate) {
      params = params.set('startDate', filters.startDate);
    }
    if (filters.endDate) {
      params = params.set('endDate', filters.endDate);
    }
    if (filters.page !== undefined) {
      params = params.set('page', filters.page.toString());
    }
    if (filters.size !== undefined) {
      params = params.set('size', filters.size.toString());
    }
    if (filters.sort) {
      params = params.set('sort', filters.sort);
    }
    if (filters.initialLoad) {
      params = params.set('initialLoad', 'true');
    }

    return this.http.get<ApiResponse<Page<AuditLog>>>(this.apiUrl, { params });
  }

  /**
   * Trae, sin paginar (hasta un tope razonable en el backend), todos los registros que
   * coinciden con los filtros activos, para poder exportarlos a PDF/Excel.
   */
  exportLogs(filters: {
    companyId?: number;
    userEmail?: string;
    action?: string;
    module?: string;
    startDate?: string;
    endDate?: string;
  }) {
    let params = new HttpParams();

    if (filters.companyId !== undefined && filters.companyId !== null) {
      params = params.set('companyId', filters.companyId.toString());
    }
    if (filters.userEmail) {
      params = params.set('userEmail', filters.userEmail);
    }
    if (filters.action) {
      params = params.set('action', filters.action);
    }
    if (filters.module) {
      params = params.set('module', filters.module);
    }
    if (filters.startDate) {
      params = params.set('startDate', filters.startDate);
    }
    if (filters.endDate) {
      params = params.set('endDate', filters.endDate);
    }

    return this.http.get<ApiResponse<AuditLog[]>>(`${this.apiUrl}/export`, { params });
  }

  /**
   * Registra en el historial de auditoría una descarga/impresión generada en el navegador
   * (PDF/Excel de horarios, cartillas, recetas...) que de otro modo no dejaría rastro, ya que
   * se genera 100% en el cliente sin pasar por ningún endpoint de negocio.
   * Falla en silencio: nunca debe bloquear ni retrasar la descarga que el usuario ya inició.
   */
  registrarDescarga(tipo: TipoDescarga, referencia?: string) {
    return this.http.post<ApiResponse<void>>(`${environment.apiUrl}/audit-logs/downloads`, {
      tipo,
      referencia: referencia?.slice(0, 150)
    }).pipe(catchError(() => of(null)));
  }
}
