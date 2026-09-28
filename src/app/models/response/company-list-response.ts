export interface CompanyListResponse {
  id: number;
  name: string;
  ruc: string;
  address: string;
  phone: string;
  email: string;
  activo: boolean;
  logoUrl?: string;
  colorPrimario?: string | null;
  slug?: string;
}
