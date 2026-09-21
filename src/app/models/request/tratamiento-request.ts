export type EstadoTratamiento = 'ACTIVO' | 'EN_CURSO' | 'COMPLETADO' | 'SUSPENDIDO' | 'PENDIENTE' | 'OTRO';

export interface TratamientoRequest {
  nombre: string;
  descripcion?: string;
  fechaInicio: string;
  fechaFin?: string;
  estado: EstadoTratamiento;
}
