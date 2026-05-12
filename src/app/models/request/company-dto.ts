export interface CompanyDTO {
  id?: number;
  name: string;
  ruc: string;
  address: string;
  phone: string;
  email: string;
  logoUrl?: string;
  website?: string;
  description?: string;
  businessHours?: string;
  openingTime?: string;
  closingTime?: string;
}
