import { formatearFechaClinica, parseFechaClinicaLocal } from './fecha-clinica.util';

describe('fecha-clinica.util', () => {
  const casos: Array<[string, number, number, number, string]> = [
    ['2026-09-09', 2026, 9, 9, '09/09/2026'],
    ['2026-09-10', 2026, 9, 10, '10/09/2026'],
    ['2026-09-11', 2026, 9, 11, '11/09/2026'],
  ];

  for (const [entrada, anio, mes, dia, esperado] of casos) {
    it(`parsea ${entrada} conservando año/mes/día exactos (sin desplazamiento de huso)`, () => {
      const local = parseFechaClinicaLocal(entrada);
      expect(local).not.toBeNull();
      expect(local!.getFullYear()).toBe(anio);
      expect(local!.getMonth() + 1).toBe(mes);
      expect(local!.getDate()).toBe(dia);
    });

    it(`formatea ${entrada} como ${esperado}`, () => {
      expect(formatearFechaClinica(entrada, { day: '2-digit', month: '2-digit', year: 'numeric' }))
        .toBe(esperado);
    });
  }

  it('tolera una fecha con componente de hora, conservando solo el día', () => {
    expect(formatearFechaClinica('2026-09-11T23:45:00', { day: '2-digit', month: '2-digit', year: 'numeric' }))
      .toBe('11/09/2026');
  });

  it('devuelve — para valores nulos, vacíos o irreconocibles', () => {
    expect(formatearFechaClinica(null)).toBe('—');
    expect(formatearFechaClinica(undefined)).toBe('—');
    expect(formatearFechaClinica('')).toBe('—');
    expect(formatearFechaClinica('no-es-una-fecha')).toBe('—');
  });

  it('caracteriza el defecto original de CP-RF31-01 bajo el huso de Perú (UTC-5)', () => {

    const fechaBuggy = new Date('2026-09-11');
    const renderizadoBuggy = fechaBuggy.toLocaleDateString('es-PE', {
      day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Lima',
    });
    expect(renderizadoBuggy).toBe('10/09/2026');
  });
});
