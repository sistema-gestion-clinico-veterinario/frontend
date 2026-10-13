
export type TipoAplicacionProducto = 'USO_GENERAL' | 'ESPECIES_ESPECIFICAS' | 'NO_ESPECIFICADO';
export type TipoControlStock = 'DIRECTO' | 'LOTES';

export type EspecieMascota =
  | 'PERRO'
  | 'GATO'
  | 'AVE'
  | 'REPTIL'
  | 'ROEDOR'
  | 'EXOTICO'
  | 'OTRO';

export const ESPECIES_OPCIONES: { value: EspecieMascota; label: string }[] = [
  { value: 'PERRO', label: 'Perro' },
  { value: 'GATO', label: 'Gato' },
  { value: 'AVE', label: 'Ave' },
  { value: 'REPTIL', label: 'Reptil' },
  { value: 'ROEDOR', label: 'Roedor' },
  { value: 'EXOTICO', label: 'Exótico' },
  { value: 'OTRO', label: 'Otro' }
];

export interface ProductoRequest {
  companyId?: number;
  nombre: string;
  categoriaId: number;
  precio: number;
  costo?: number | null;
  marca?: string;
  marcaId: number;
  stock?: number;
  controlStock: TipoControlStock;
  stockMinimo?: number;
  descripcion?: string;
  imagenUrl?: string;
  codigoBarras?: string;
  fechaVencimiento?: string;
  requiereReceta?: boolean;
  unidadMedidaId?: number | null;
  aplicacionEspecie: TipoAplicacionProducto;
  especies: EspecieMascota[];
}
