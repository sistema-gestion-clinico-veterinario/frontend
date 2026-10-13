export type TipoInactividad = 'SUSPENSION' | 'BAJA';


export interface ApoderadoEstadoResponse {
  mascotasPausadas: string[];
  mascotasRestauradas: string[];
  mascotasQueSiguenActivas: string[];
  mascotasConCitasVigentes: string[];
  mascotasQueSiguenInactivas?: string[];
}
