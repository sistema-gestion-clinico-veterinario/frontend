export interface EncabezadoEmpresaPdf {
  name?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  ruc?: string | null;
}

export interface NotaVentaPreview {
  url: string;
  nombreArchivo: string;
  referencia: string;
}
