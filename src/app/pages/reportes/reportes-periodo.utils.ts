export type Periodo = 'hoy' | 'semana' | 'mes' | '3meses' | '6meses' | '12meses' | 'personalizado';

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


export const RANGO_MESES_MAXIMO = 36;

function rangoUltimosMeses(hoy: Date, meses: number): RangoPeriodo {
  const desde = new Date(hoy);
  desde.setMonth(hoy.getMonth() - meses);
  return {
    fechaDesde: toDateInput(desde),
    fechaHasta: toDateInput(hoy)
  };
}

export function calcularRangoPeriodo(
  periodo: Periodo,
  fechaReferencia = obtenerFechaActualLima()
): RangoPeriodo {
  const hoy = new Date(fechaReferencia);

  switch (periodo) {
    case '3meses':
      return rangoUltimosMeses(hoy, 3);
    case '6meses':
      return rangoUltimosMeses(hoy, 6);
    case '12meses':
      return rangoUltimosMeses(hoy, 12);
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
