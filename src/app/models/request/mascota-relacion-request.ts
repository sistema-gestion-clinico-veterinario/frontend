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
  fechaFin?: string | null;
  observaciones?: string | null;
}
