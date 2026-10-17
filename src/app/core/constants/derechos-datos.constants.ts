import { EstadoSolicitudDerecho, TipoDerechoDatos } from '../../models/privacy/derechos-datos.model';

export const ETIQUETA_DE_DERECHO: Record<TipoDerechoDatos, string> = {
  ACCESO: 'Acceso',
  RECTIFICACION: 'Rectificación',
  OPOSICION: 'Oposición',
  PORTABILIDAD: 'Portabilidad'
};

export const AYUDA_DE_DERECHO: Record<TipoDerechoDatos, string> = {
  ACCESO: 'Conoce qué datos conserva la clínica y cómo los trata.',
  RECTIFICACION: 'Corrige datos inexactos o desactualizados.',
  OPOSICION: 'Solicita que un tratamiento específico deje de realizarse.',
  PORTABILIDAD: 'Solicita tus datos en un formato estructurado cuando corresponda.'
};

export const TIPOS_DE_DERECHO = Object.keys(ETIQUETA_DE_DERECHO) as TipoDerechoDatos[];

export const ESTADO_DE_SOLICITUD: Record<EstadoSolicitudDerecho, { etiqueta: string; clases: string }> = {
  RECIBIDA: { etiqueta: 'Recibida', clases: 'border-slate-200 bg-slate-50 text-slate-700' },
  EN_REVISION: { etiqueta: 'En revisión', clases: 'border-slate-200 bg-slate-50 text-slate-700' },
  REQUIERE_INFORMACION: { etiqueta: 'Requiere información', clases: 'border-slate-300 bg-slate-100 text-slate-700' },
  ATENDIDA: { etiqueta: 'Atendida', clases: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  RECHAZADA: { etiqueta: 'Rechazada', clases: 'border-rose-200 bg-rose-50 text-rose-700' }
};
