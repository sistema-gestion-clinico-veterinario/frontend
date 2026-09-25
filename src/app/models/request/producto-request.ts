export interface ProductoRequest {
  companyId?: number;
  nombre: string;
  categoriaId: number;
  precio: number;
  stock?: number;
  descripcion?: string;
  imagenUrl?: string;
}
