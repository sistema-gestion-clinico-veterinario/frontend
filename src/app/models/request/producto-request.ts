export interface ProductoRequest {
  companyId?: number;
  nombre: string;
  categoriaId: number;
  precio: number;
  costo?: number | null;
  marca?: string;
  marcaId: number;
  stock?: number;
  stockMinimo?: number;
  descripcion?: string;
  imagenUrl?: string;
  codigoBarras?: string;
  fechaVencimiento?: string;
  requiereReceta?: boolean;
  unidadMedidaId?: number | null;
}
