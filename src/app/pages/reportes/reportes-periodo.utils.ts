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

export function calcularRangoPeriodo(
  periodo: Periodo,
  fechaReferencia = new Date()
): RangoPeriodo {
  const hoy = new Date(fechaReferencia);

  switch (periodo) {
    case 'todos': {
      const desde = new Date(hoy);
      desde.setFullYear(hoy.getFullYear() - 2);
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
