export interface ProductoResponse {
  id: number;
  companyId: number;
  companyName: string;
  nombre: string;
  categoriaId: number;
  categoriaNombre: string;
  precio: number;
  stock: number;
  descripcion?: string;
  imagenUrl?: string;
  activo: boolean;
}
