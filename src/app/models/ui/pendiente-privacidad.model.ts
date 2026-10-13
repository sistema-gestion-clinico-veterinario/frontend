import { PendientePrivacidadId } from '../../types/pendiente-privacidad-id.type';

export interface PendientePrivacidad {
  id: PendientePrivacidadId;
  titulo: string;
  detalle: string;
  ruta: string;
  fragmento?: string;
  opcional: boolean;
}
