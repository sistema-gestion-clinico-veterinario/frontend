import { EstadoConsentimientoVeterinario } from '../../models/privacy/consentimiento-veterinario.model';

export const ESTADO_DE_CONSENTIMIENTO: Record<EstadoConsentimientoVeterinario, { etiqueta: string; clases: string }> = {
  PENDIENTE: { etiqueta: 'Pendiente de decisión', clases: 'border-slate-200 bg-slate-50 text-slate-700' },
  ACEPTADO: { etiqueta: 'Aceptado', clases: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  RECHAZADO: { etiqueta: 'Rechazado', clases: 'border-rose-200 bg-rose-50 text-rose-700' },
  REVOCADO: { etiqueta: 'Revocado', clases: 'border-slate-300 bg-slate-100 text-slate-600' }
};
