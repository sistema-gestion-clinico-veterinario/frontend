import { EspecieMascota, TipoAplicacionProducto, TipoControlStock } from '../request/producto-request';

export interface ProductoResponse {
  id: number;
  companyId: number;
  companyName: string;
  nombre: string;
  categoriaId: number;
  categoriaNombre: string;
  precio: number;
  costo?: number;
  marca?: string;
  marcaId?: number;
  stock: number;
  controlStock: TipoControlStock;
  stockMinimo: number;
  descripcion?: string;
  imagenUrl?: string;
  sku: string;
  codigoBarras?: string;
  fechaVencimiento?: string;
  requiereReceta: boolean;
  unidadMedidaId?: number;
  unidadMedidaNombre?: string;
  aplicacionEspecie: TipoAplicacionProducto;
  especies: EspecieMascota[];
  proximoVencimientoLote?: string;
  activo: boolean;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}
