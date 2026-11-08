import { TipoInactividad } from './apoderado-estado-response';

export interface ApoderadoListResponse {
  id: number;
  userId?: number;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  tipoDocumento: string;
  numeroDocumento: string;
  activo: boolean;
  cuentaPendiente?: boolean;
  puedeReenviarInvitacion?: boolean;
  estadoAccesoPortal?: 'SIN_ACCESO' | 'INVITACION_PENDIENTE' | 'ACTIVO' | 'SUSPENDIDO' | 'REVOCADO';
  tipoInactividad?: TipoInactividad | null;
}
