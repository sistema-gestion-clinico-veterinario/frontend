import { CanalSolicitudCancelacion } from '../../types/cancelacion/canal-solicitud-cancelacion.type';
import { EstadoSolicitudCancelacion } from '../../types/cancelacion/estado-solicitud-cancelacion.type';

export interface SolicitudCancelacion {
  id: number;
  estado: EstadoSolicitudCancelacion;
  canal: CanalSolicitudCancelacion;
  identidadVerificada: boolean;
  metodoVerificacion: string;
  motivoTitular: string | null;
  creadaAt: string;
  fechaLimite: string;
  vencida: boolean;
  resueltaAt: string | null;
  motivoResolucion: string | null;
  titularNombre: string | null;
  titularCorreo: string | null;
  titularDocumento: string | null;
  puedeEjecutarse: boolean;
  impedimento: string | null;
}

export interface CancelacionDatosElegibilidad {
  puedeSolicitar: boolean;
  motivoBloqueo: string | null;
  requierePassword: boolean;
  solicitudVigente: SolicitudCancelacion | null;
}

export interface RegistrarCancelacion {
  apoderadoId: number;
  metodoVerificacion: string;
  motivo?: string | null;
}
