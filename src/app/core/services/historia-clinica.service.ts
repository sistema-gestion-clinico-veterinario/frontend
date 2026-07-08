import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { HistoriaClinicaDetalle } from '../../models/response/historia-clinica-response';
import { ConsultaResponse } from '../../models/response/consulta-response';
import { ConsultaRequest, CerrarConsultaRequest } from '../../models/request/consulta-request';
import { PrescripcionRequest } from '../../models/request/prescripcion-request';
import { PrescripcionResponse } from '../../models/response/prescripcion-response';
import { ArchivoClinicoResponse } from '../../models/response/archivo-clinico-response';
import { Page } from '../../models/response/page';
import { ApiResponse } from '../../models/response/api-response';
import { SKIP_GLOBAL_LOADING } from '../interceptors/api.interceptor';

@Injectable({
  providedIn: 'root'
})
export class HistoriaClinicaService {
  private readonly http            = inject(HttpClient);
  private readonly hcUrl           = `${environment.apiUrl}/medical-records`;
  private readonly citasUrl        = `${environment.apiUrl}/consultations`;
  private readonly recetasUrl      = `${environment.apiUrl}/prescriptions`;
  private readonly baseUrl         = environment.apiUrl;

  buscar(query: { numeroHc?: string; nombrePaciente?: string; nombrePropietario?: string; fechaDesde?: string; fechaHasta?: string; companyId?: number; page?: number; size?: number }) {
    let params = `?page=${query.page || 0}&size=${query.size || 10}`;
    if (query.numeroHc)          params += `&numeroHc=${encodeURIComponent(query.numeroHc)}`;
    if (query.nombrePaciente)    params += `&nombrePaciente=${encodeURIComponent(query.nombrePaciente)}`;
    if (query.nombrePropietario) params += `&nombrePropietario=${encodeURIComponent(query.nombrePropietario)}`;
    if (query.fechaDesde)        params += `&fechaDesde=${encodeURIComponent(query.fechaDesde)}`;
    if (query.fechaHasta)        params += `&fechaHasta=${encodeURIComponent(query.fechaHasta)}`;
    if (query.companyId != null) params += `&companyId=${query.companyId}`;

    return this.http.get<ApiResponse<Page<any>>>(`${this.hcUrl}${params}`);
  }

  getPorMascota(mascotaId: number) {
    return this.http.get<ApiResponse<HistoriaClinicaDetalle>>(`${this.hcUrl}/pet/${mascotaId}`);
  }

  getPorNumeroHc(numeroHc: string) {
    return this.http.get<ApiResponse<HistoriaClinicaDetalle>>(`${this.hcUrl}/numero/${encodeURIComponent(numeroHc)}`);
  }

  getConsulta(consultaId: number) {
    return this.http.get<ApiResponse<ConsultaResponse>>(`${this.citasUrl}/${consultaId}`);
  }

  updateConsulta(consultaId: number, request: ConsultaRequest, silent = false) {
    const options = silent
      ? { context: new HttpContext().set(SKIP_GLOBAL_LOADING, true) }
      : {};
    return this.http.put<ApiResponse<ConsultaResponse>>(`${this.citasUrl}/${consultaId}`, request, options);
  }

  cerrarConsulta(consultaId: number, request: CerrarConsultaRequest) {
    return this.http.patch<ApiResponse<ConsultaResponse>>(`${this.citasUrl}/${consultaId}/close`, request);
  }

  crearReceta(consultaId: number, request: PrescripcionRequest) {
    return this.http.post<ApiResponse<PrescripcionResponse>>(`${this.recetasUrl}/consultation/${consultaId}`, request);
  }

  listarRecetas(consultaId: number) {
    return this.http.get<ApiResponse<PrescripcionResponse[]>>(`${this.recetasUrl}/consultation/${consultaId}`);
  }

  actualizarReceta(id: number, request: PrescripcionRequest) {
    return this.http.put<ApiResponse<PrescripcionResponse>>(`${this.recetasUrl}/${id}`, request);
  }

  eliminarReceta(id: number) {
    return this.http.delete<ApiResponse<void>>(`${this.recetasUrl}/${id}`);
  }

  buscarRecetas(filters: {
    query?: string;
    companyId?: number;
    nombreMascota?: string;
    numeroMicrochip?: string;
    numeroDocumentoApoderado?: string;
    numeroDocumentoEmpleado?: string;
    numeroHc?: string;
    fechaDesde?: string;
    fechaHasta?: string;
  }, page: number = 0, size: number = 10) {
    let params = `?query=${encodeURIComponent(filters.query || '')}&page=${page}&size=${size}`;
    if (filters.companyId != null) params += `&companyId=${filters.companyId}`;
    if (filters.nombreMascota) params += `&nombreMascota=${encodeURIComponent(filters.nombreMascota)}`;
    if (filters.numeroMicrochip) params += `&numeroMicrochip=${encodeURIComponent(filters.numeroMicrochip)}`;
    if (filters.numeroDocumentoApoderado) params += `&numeroDocumentoApoderado=${encodeURIComponent(filters.numeroDocumentoApoderado)}`;
    if (filters.numeroDocumentoEmpleado) params += `&numeroDocumentoEmpleado=${encodeURIComponent(filters.numeroDocumentoEmpleado)}`;
    if (filters.numeroHc) params += `&numeroHc=${encodeURIComponent(filters.numeroHc)}`;
    if (filters.fechaDesde) params += `&fechaDesde=${filters.fechaDesde}`;
    if (filters.fechaHasta) params += `&fechaHasta=${filters.fechaHasta}`;
    return this.http.get<ApiResponse<Page<PrescripcionResponse>>>(`${this.recetasUrl}${params}`);
  }

  listarArchivos(consultaId: number) {
    return this.http.get<ApiResponse<ArchivoClinicoResponse[]>>(`${this.citasUrl}/${consultaId}/files`);
  }

  subirArchivo(consultaId: number, file: File, tipo: string, descripcion?: string) {
    const form = new FormData();
    form.append('file', file);
    form.append('tipo', tipo);
    if (descripcion) form.append('descripcion', descripcion);
    return this.http.post<ApiResponse<ArchivoClinicoResponse>>(`${this.citasUrl}/${consultaId}/files`, form);
  }

  obtenerContenidoArchivo(consultaId: number, id: number, descargar = false) {
    return this.http.get(`${this.citasUrl}/${consultaId}/files/${id}/content?descargar=${descargar}`, { responseType: 'blob' });
  }

  eliminarArchivo(consultaId: number, id: number) {
    return this.http.delete<ApiResponse<void>>(`${this.citasUrl}/${consultaId}/files/${id}`);
  }
}
