export interface Permission {
  id: number;
  name: string;
  label: string;
  description: string;
  module: string;
}

export interface Role {
  id: number;
  name: string;
  descripcion?: string;
  activo: boolean;
  companyId: number | null;
}
