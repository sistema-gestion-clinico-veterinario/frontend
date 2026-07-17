export interface ServicioRequest {
  companyId?: number;
  nombre: string;
  descripcion: string;
  precio: number;
  disponible?: boolean;
  tipoControlPreventivo?: 'VACUNACION' | 'DESPARASITACION' | 'NO_APLICA';
}
