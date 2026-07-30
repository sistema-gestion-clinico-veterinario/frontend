import { calcularRangoPeriodo } from './reportes-periodo.utils';

describe('calcularRangoPeriodo', () => {
  const referencia = new Date('2026-07-30T12:00:00');

  it('debe devolver el mismo día para el periodo hoy', () => {
    expect(calcularRangoPeriodo('hoy', referencia))
      .toEqual({ fechaDesde: '2026-07-30', fechaHasta: '2026-07-30' });
  });

  it('debe devolver la semana completa empezando en lunes', () => {
    expect(calcularRangoPeriodo('semana', referencia))
      .toEqual({ fechaDesde: '2026-07-27', fechaHasta: '2026-08-02' });
  });

  it('debe devolver todo el mes actual', () => {
    expect(calcularRangoPeriodo('mes', referencia))
      .toEqual({ fechaDesde: '2026-07-01', fechaHasta: '2026-07-31' });
  });

  it('debe devolver los últimos 24 meses para el periodo todos', () => {
    expect(calcularRangoPeriodo('todos', referencia))
      .toEqual({ fechaDesde: '2024-07-30', fechaHasta: '2026-07-30' });
  });

  it('debe dejar el rango vacío para un periodo personalizado', () => {
    expect(calcularRangoPeriodo('personalizado', referencia))
      .toEqual({ fechaDesde: '', fechaHasta: '' });
  });
});
