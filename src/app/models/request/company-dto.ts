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
  operatingHours?: CompanyOperatingHourDTO[];
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface CompanyOperatingHourDTO {
  diaSemana: string;
  openingTime: string;
  closingTime: string;
  isOpen: boolean;
}
