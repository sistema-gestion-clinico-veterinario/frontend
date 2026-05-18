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
  companyId: number | null;
  permissions: Permission[];
  menuIds: number[];
}
