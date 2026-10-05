export type TipoRelacionMascota =
  | 'COPROPIETARIO'
  | 'REPRESENTANTE_AUTORIZADO'
  | 'RESPONSABLE_PAGO';

export interface MascotaRelacionRequest {
  apoderadoId: number;
  tipoRelacion: TipoRelacionMascota;
  puedeRecibirInformacion: boolean;
  puedeAutorizarAtencion: boolean;
  puedeRealizarPagos: boolean;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  observaciones?: string | null;
  darAccesoPortal?: boolean;
}
