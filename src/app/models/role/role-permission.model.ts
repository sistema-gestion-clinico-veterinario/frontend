export interface RolVentanaPermiso {
  ventanaId: number;
  vistaId?: number;
  codigo: string;
  nombre: string;
  icono: string | null;
  ruta?: string;
  parentId: number | null;
  parentCodigo: string | null;
  leer: boolean;
  escribir: boolean;
  modificar: boolean;
  eliminar: boolean;
  dataScope: 'OWN' | 'COMPANY';
  visibleMenu: boolean;
  vistas?: RolVistaPermiso[];
}

export interface RolVistaPermiso {
  vistaId: number;
  codigo: string;
  nombre: string;
  grupo?: string;
  ruta?: string;
  leer: boolean;
  escribir: boolean;
  modificar: boolean;
  eliminar: boolean;
  dataScope: 'OWN' | 'COMPANY';
  visibleMenu: boolean;
}
