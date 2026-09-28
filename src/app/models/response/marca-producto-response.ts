export interface MarcaProductoResponse {
  id: number;
  companyId: number;
  companyName: string;
  nombre: string;
  descripcion?: string;
  activo: boolean;
  productosAsociados: number;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}
