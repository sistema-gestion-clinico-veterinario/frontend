export interface SugerenciaControlResponse {
  origen: 'TRATAMIENTO' | 'DIAGNOSTICO';
  origenId: number;
  nombre: string;
  mascotaId: number;
  mascotaNombre: string;
  apoderadoId?: number;
  apoderadoNombre?: string;
  fechaControl: string;
  diasRestantes: number;
}
