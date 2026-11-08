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
  slug?: string;
  colorPrimario?: string;
  modoAccesoPropietario?: OwnerPortalMode;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export type OwnerPortalMode = 'SOLO_GESTION_INTERNA' | 'PORTAL_OPCIONAL' | 'PORTAL_POR_DEFECTO';

export interface CompanyOperatingHourDTO {
  diaSemana: string;
  openingTime: string;
  closingTime: string;
  isOpen: boolean;
}
