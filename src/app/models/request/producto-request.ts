export interface ProductoRequest {
  companyId?: number;
  nombre: string;
  categoriaId: number;
  precio: number;
  stock?: number;
  stockMinimo?: number;
  descripcion?: string;
  imagenUrl?: string;
}
