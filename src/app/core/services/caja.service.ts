import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';
import { Page } from '../../models/response/page';
import { MovimientoCajaResponse, ResumenCajaResponse, SesionCajaResponse } from '../../models/response/movimiento-caja-response';
import { EstadoEquipo, PuntoCobro } from '../../models/response/punto-cobro';
import { MovimientoEgresoRequest } from '../../models/request/movimiento-egreso-request';
import { CuentaCitaResponse, DetalleCuentaRequest } from '../../models/response/cuenta-cita-response';
import { SKIP_GLOBAL_LOADING } from '../interceptors/api.interceptor';

@Injectable({ providedIn: 'root' })
export class CajaService {
  private readonly http   = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/caja`;

  listar(companyId: number, desde?: string, hasta?: string, page = 0, size = 20) {
    let params = new HttpParams().set('companyId', companyId).set('page', page).set('size', size);
    if (desde) params = params.set('desde', desde);
    if (hasta) params = params.set('hasta', hasta);
    return this.http.get<ApiResponse<Page<MovimientoCajaResponse>>>(this.apiUrl, { params });
  }

  resumen(companyId: number, desde?: string, hasta?: string) {
    let params = new HttpParams().set('companyId', companyId);
    if (desde) params = params.set('desde', desde);
    if (hasta) params = params.set('hasta', hasta);
    return this.http.get<ApiResponse<ResumenCajaResponse>>(`${this.apiUrl}/resumen`, { params });
  }

  registrarEgreso(request: MovimientoEgresoRequest) {
    return this.http.post<ApiResponse<MovimientoCajaResponse>>(`${this.apiUrl}/egreso`, request);
  }

  registrarDevolucion(citaId: number) {
    return this.http.post<ApiResponse<MovimientoCajaResponse>>(`${this.apiUrl}/devolucion/${citaId}`, {});
  }

  obtenerSesion(companyId: number) {
    const params = new HttpParams().set('companyId', companyId);
    return this.http.get<ApiResponse<SesionCajaResponse | null>>(`${this.apiUrl}/sesion`, { params });
  }

  abrirCaja(companyId: number, montoApertura: number) {
    return this.http.post<ApiResponse<SesionCajaResponse>>(`${this.apiUrl}/sesion/abrir`, { companyId, montoApertura });
  }

  arquearCaja(companyId: number, efectivoContado: number, observaciones?: string) {
    return this.http.post<ApiResponse<SesionCajaResponse>>(`${this.apiUrl}/sesion/arqueo`, { companyId, efectivoContado, observaciones });
  }

  cerrarCaja(companyId: number, efectivoContado: number, observaciones?: string, sesionId?: number) {
    return this.http.post<ApiResponse<SesionCajaResponse>>(`${this.apiUrl}/sesion/cerrar`,
      { companyId, efectivoContado, observaciones, ...(sesionId ? { sesionId } : {}) });
  }

  esteEquipo(companyId: number) {
    const params = new HttpParams().set('companyId', companyId);
    return this.http.get<ApiResponse<EstadoEquipo>>(`${this.apiUrl}/puntos/este-equipo`, { params });
  }

  puntosCobro(companyId: number) {
    const params = new HttpParams().set('companyId', companyId);
    return this.http.get<ApiResponse<PuntoCobro[]>>(`${this.apiUrl}/puntos`, { params });
  }

  crearPuntoCobro(companyId: number, nombre: string) {
    return this.http.post<ApiResponse<PuntoCobro>>(`${this.apiUrl}/puntos`, { companyId, nombre });
  }

  actualizarPuntoCobro(id: number, companyId: number, nombre: string, activa?: boolean) {
    return this.http.put<ApiResponse<PuntoCobro>>(`${this.apiUrl}/puntos/${id}`,
      { companyId, nombre, ...(activa === undefined ? {} : { activa }) });
  }

  vincularPuntoCobro(id: number, companyId: number) {
    const params = new HttpParams().set('companyId', companyId);
    return this.http.post<ApiResponse<PuntoCobro>>(`${this.apiUrl}/puntos/${id}/vincular`, {}, { params });
  }

  desvincularPuntoCobro(id: number, companyId: number) {
    const params = new HttpParams().set('companyId', companyId);
    return this.http.post<ApiResponse<PuntoCobro>>(`${this.apiUrl}/puntos/${id}/desvincular`, {}, { params });
  }

  listarPendientes(companyId: number, page = 0, size = 20) {
    const params = new HttpParams().set('companyId', companyId).set('page', page).set('size', size);
    return this.http.get<ApiResponse<Page<CuentaCitaResponse>>>(`${this.apiUrl}/cuentas/pendientes`, {
      params,
      context: new HttpContext().set(SKIP_GLOBAL_LOADING, true)
    });
  }

  listarSesiones(companyId: number, page = 0, size = 10) {
    const params = new HttpParams().set('companyId', companyId).set('page', page).set('size', size);
    return this.http.get<ApiResponse<Page<SesionCajaResponse>>>(`${this.apiUrl}/sesion/historial`, { params });
  }

  obtenerCuenta(citaId: number) {
    return this.http.get<ApiResponse<CuentaCitaResponse>>(`${this.apiUrl}/cuentas/${citaId}`);
  }

  agregarDetalle(citaId: number, request: DetalleCuentaRequest) {
    return this.http.post<ApiResponse<CuentaCitaResponse>>(`${this.apiUrl}/cuentas/${citaId}/detalles`, request);
  }

  eliminarDetalle(citaId: number, detalleId: number) {
    return this.http.delete<ApiResponse<CuentaCitaResponse>>(`${this.apiUrl}/cuentas/${citaId}/detalles/${detalleId}`);
  }

  actualizarDetalle(citaId: number, detalleId: number, request: DetalleCuentaRequest) {
    return this.http.put<ApiResponse<CuentaCitaResponse>>(`${this.apiUrl}/cuentas/${citaId}/detalles/${detalleId}`, request);
  }
}
