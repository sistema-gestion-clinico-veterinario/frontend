export type TipoRelacionMascotaResponse =
  | 'PROPIETARIO_PRINCIPAL'
  | 'COPROPIETARIO'
  | 'REPRESENTANTE_AUTORIZADO'
  | 'RESPONSABLE_PAGO';

export interface MascotaRelacionResponse {
  uuid: string;
  mascotaUuid: string;
  mascotaNombre: string;
  apoderadoId: number;
  personaNombre: string;
  numeroDocumento: string;
  tipoRelacion: TipoRelacionMascotaResponse;
  puedeRecibirInformacion: boolean;
  puedeAutorizarAtencion: boolean;
  puedeRealizarPagos: boolean;
  fechaInicio: string;
  fechaFin?: string | null;
  observaciones?: string | null;
  activo: boolean;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}
