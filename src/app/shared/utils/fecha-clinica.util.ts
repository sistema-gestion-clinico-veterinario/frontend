/**
 * Utilidades para mostrar fechas clínicas (LocalDate del backend, "YYYY-MM-DD",
 * con o sin componente de hora) sin desplazarlas por conversión de zona horaria.
 *
 * `new Date("2026-09-11")` interpreta la fecha como medianoche UTC; al
 * renderizarla con `toLocaleDateString()` en un huso horario negativo (como
 * Perú, UTC-5) retrocede al día calendario anterior. Estas funciones evitan
 * ese desplazamiento construyendo el `Date` con el constructor de
 * componentes locales (año, mes, día), que nunca aplica conversión de zona.
 */

const PATRON_FECHA = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * Parsea el componente de fecha (ignora la hora si viene incluida, p. ej.
 * "2026-09-11T14:30:00") como fecha local, preservando el día calendario.
 * Devuelve `null` si el valor no trae un componente de fecha reconocible.
 */
export function parseFechaClinicaLocal(fecha: string | null | undefined): Date | null {
  if (!fecha) return null;
  const match = fecha.match(PATRON_FECHA);
  if (!match) return null;
  const [, anio, mes, dia] = match;
  return new Date(Number(anio), Number(mes) - 1, Number(dia));
}

/**
 * Formatea una fecha clínica sin desplazamiento de zona horaria.
 * Devuelve '—' si la fecha es nula, vacía o no reconocible.
 */
export function formatearFechaClinica(
  fecha: string | null | undefined,
  opciones: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' },
  locale = 'es-PE',
): string {
  const local = parseFechaClinicaLocal(fecha);
  return local ? local.toLocaleDateString(locale, opciones) : '—';
}
