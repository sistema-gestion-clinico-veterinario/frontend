export interface VentanaDTO {
  id: number;
  codigo: string;
  nombre: string;
  activo: boolean;
  orden?: number;
  grupo?: string | null;
  icono?: string | null;
  presentacionDefault?: string;
}

export interface VistaReordenItem {
  id: number;
  orden: number;
  ventanaId?: number | null;
  sinModulo?: boolean;
}
