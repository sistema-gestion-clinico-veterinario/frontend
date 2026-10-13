export interface CompanyBrandingResponse {
  name: string;
  logoUrl: string | null;
  colorPrimario: string | null;
}

export interface CompanySearchResult {
  name: string;
  slug: string;
  logoUrl: string | null;
}
