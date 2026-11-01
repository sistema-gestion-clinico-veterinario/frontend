export interface PuntoCobro {
  id: number;
  nombre: string;
  activa: boolean;
  vinculada: boolean;
  dispositivoNombre: string | null;
  dispositivoInfo: string | null;
  vinculadaAt: string | null;
  ultimoUsoAt: string | null;
  esEsteEquipo: boolean;
  sesionAbierta: boolean;
  abiertaPorNombre: string | null;
}

export type ModoEquipo = 'DISPOSITIVO' | 'SENCILLO' | 'NO_REGISTRADO';

export interface EstadoEquipo {
  modo: ModoEquipo;
  cajaNombre: string | null;
  equipoNombre: string | null;
  mensaje: string;
}
