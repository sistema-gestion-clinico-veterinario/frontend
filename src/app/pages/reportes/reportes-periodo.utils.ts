export type Periodo = 'todos' | 'hoy' | 'semana' | 'mes' | 'personalizado';

export interface RangoPeriodo {
  fechaDesde: string;
  fechaHasta: string;
}

function toDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Día calendario "de hoy" según la zona horaria de la clínica (America/Lima), no la del navegador.
 * El backend calcula todos sus rangos con AppClock (fijo a Lima); si el filtro rápido usara el reloj
 * local del dispositivo, un usuario en otra zona horaria vería un rango distinto al que espera la clínica.
 */
function obtenerFechaActualLima(): Date {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const valor = (tipo: string) => Number(partes.find(p => p.type === tipo)?.value);
  return new Date(valor('year'), valor('month') - 1, valor('day'));
}

/** Tope máximo del periodo "Todos", alineado con el límite de 36 meses que ya aplica el backend a rangos personalizados. */
export const TODOS_MESES_MAXIMO = 36;

export function calcularRangoPeriodo(
  periodo: Periodo,
  fechaReferencia = obtenerFechaActualLima()
): RangoPeriodo {
  const hoy = new Date(fechaReferencia);

  switch (periodo) {
    case 'todos': {
      const desde = new Date(hoy);
      desde.setMonth(hoy.getMonth() - TODOS_MESES_MAXIMO);
      return {
        fechaDesde: toDateInput(desde),
        fechaHasta: toDateInput(hoy)
      };
    }
    case 'hoy':
      return {
        fechaDesde: toDateInput(hoy),
        fechaHasta: toDateInput(hoy)
      };
    case 'semana': {
      const diaSemana = hoy.getDay() || 7;
      const desde = new Date(hoy);
      desde.setDate(hoy.getDate() - diaSemana + 1);
      const hasta = new Date(desde);
      hasta.setDate(desde.getDate() + 6);
      return {
        fechaDesde: toDateInput(desde),
        fechaHasta: toDateInput(hasta)
      };
    }
    case 'mes':
      return {
        fechaDesde: toDateInput(new Date(hoy.getFullYear(), hoy.getMonth(), 1)),
        fechaHasta: toDateInput(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0))
      };
    case 'personalizado':
      return { fechaDesde: '', fechaHasta: '' };
  }
}
