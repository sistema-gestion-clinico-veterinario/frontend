export type TipoInactividad = 'SUSPENSION' | 'BAJA';

/** Qué pasó con las mascotas de un cliente al suspenderlo, darlo de baja o reactivarlo. */
export interface ApoderadoEstadoResponse {
  mascotasPausadas: string[];
  mascotasRestauradas: string[];
  mascotasQueSiguenActivas: string[];
  mascotasConCitasVigentes: string[];
  /** Al reactivar: siguen inactivas porque el personal las dio de baja por otro motivo, con el motivo entre paréntesis. */
  mascotasQueSiguenInactivas?: string[];
}
