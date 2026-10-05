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
  tipoInactividad?: TipoInactividad | null;
}
