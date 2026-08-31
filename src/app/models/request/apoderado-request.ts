export interface ApoderadoRequest {
  id?: number;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  tipoDocumento: string;
  numeroDocumento: string;
  direccion?: string;
  genero: string;
  referencias?: string;
  observaciones?: string;
  companyId?: number;
  roleIds?: number[];
}
