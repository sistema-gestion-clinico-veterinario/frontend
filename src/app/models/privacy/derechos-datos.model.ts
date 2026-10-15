export type TipoDerechoDatos = 'ACCESO' | 'RECTIFICACION' | 'OPOSICION' | 'PORTABILIDAD';
export type EstadoSolicitudDerecho = 'RECIBIDA' | 'EN_REVISION' | 'REQUIERE_INFORMACION' | 'ATENDIDA' | 'RECHAZADA';

export interface SolicitudDerechoDatos {
  id: number;
  tipo: TipoDerechoDatos;
  estado: EstadoSolicitudDerecho;
  descripcion: string;
  datoRectificar: string | null;
  identidadVerificada: boolean;
  metodoVerificacion: string;
  creadaAt: string;
  fechaLimite: string;
  vencida: boolean;
  respuesta: string | null;
  motivoRechazo: string | null;
  resueltaAt: string | null;
  titular: string | null;
  correoTitular: string | null;
}
