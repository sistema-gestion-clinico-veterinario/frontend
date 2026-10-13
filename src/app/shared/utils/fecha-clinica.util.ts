

const PATRON_FECHA = /^(\d{4})-(\d{2})-(\d{2})/;

export function parseFechaClinicaLocal(fecha: string | null | undefined): Date | null {
  if (!fecha) return null;
  const match = fecha.match(PATRON_FECHA);
  if (!match) return null;
  const [, anio, mes, dia] = match;
  return new Date(Number(anio), Number(mes) - 1, Number(dia));
}


export function formatearFechaClinica(
  fecha: string | null | undefined,
  opciones: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' },
  locale = 'es-PE',
): string {
  const local = parseFechaClinicaLocal(fecha);
  return local ? local.toLocaleDateString(locale, opciones) : '—';
}
