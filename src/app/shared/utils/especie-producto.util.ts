import { EspecieMascota, TipoAplicacionProducto } from '../../models/request/producto-request';

const ESPECIES_EN_PLURAL: Record<EspecieMascota, string> = {
  PERRO: 'perros',
  GATO: 'gatos',
  AVE: 'aves',
  REPTIL: 'reptiles',
  ROEDOR: 'roedores',
  EXOTICO: 'exóticos',
  OTRO: 'otros'
};

export interface EtiquetaAplicacionEspecie {
  texto: string;
  clase: string;
}

const CLASE_USO_GENERAL = 'rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600';
const CLASE_ESPECIES = 'rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700';
const CLASE_SIN_ESPECIES = 'rounded-full bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold text-rose-600';

/**
 * Etiqueta para el catálogo de venta: "Uso general" o "Para: perros y gatos".
 * Devuelve null cuando el producto todavía no está clasificado (registros antiguos).
 */
export function etiquetaAplicacionEspecie(
  aplicacion?: TipoAplicacionProducto | null,
  especies?: readonly EspecieMascota[] | null
): EtiquetaAplicacionEspecie | null {
  if (aplicacion === 'USO_GENERAL') {
    return { texto: 'Uso general', clase: CLASE_USO_GENERAL };
  }
  if (aplicacion !== 'ESPECIES_ESPECIFICAS') {
    return null;
  }

  const nombres = (especies ?? []).map(especie => ESPECIES_EN_PLURAL[especie] ?? String(especie).toLowerCase());
  if (nombres.length === 0) {
    return { texto: 'Sin especies', clase: CLASE_SIN_ESPECIES };
  }
  return { texto: `Para: ${unirNombres(nombres)}`, clase: CLASE_ESPECIES };
}

/** Indica si un producto puede utilizarse normalmente para la especie de una cita. */
export function productoCompatibleConEspecie(
  aplicacion: TipoAplicacionProducto | null | undefined,
  especies: readonly EspecieMascota[] | null | undefined,
  especieMascota: EspecieMascota | null | undefined
): boolean {
  if (!especieMascota || aplicacion !== 'ESPECIES_ESPECIFICAS') return true;
  return (especies ?? []).includes(especieMascota);
}

function unirNombres(nombres: string[]): string {
  if (nombres.length === 1) return nombres[0];
  if (nombres.length === 2) return `${nombres[0]} y ${nombres[1]}`;
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}
