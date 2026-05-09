export interface ArchivoClinicoResponse {
  id: number;
  nombre: string;
  tipo: string;
  tipoMime?: string;
  tamanioBytes?: number;
  url?: string;
  descripcion?: string;
  subidoPor?: string;
  fechaCarga?: string;
}
