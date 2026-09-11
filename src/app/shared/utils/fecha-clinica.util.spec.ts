import { formatearFechaClinica, parseFechaClinicaLocal } from './fecha-clinica.util';

/**
 * CP-RF31-01: una fecha clínica pura (YYYY-MM-DD) debe conservar el mismo
 * día calendario mostrado al usuario, sin desplazarse por zona horaria.
 *
 * `parseFechaClinicaLocal` construye el `Date` a partir de sus componentes
 * locales (año, mes, día), no de un parseo ISO. Esa construcción es, por
 * diseño, invariante ante el huso horario de la máquina que ejecuta la
 * prueba: los getters getFullYear/getMonth/getDate de un `Date` construido
 * así siempre devuelven exactamente lo que se pasó, sin importar el huso.
 * Por eso las aserciones principales no dependen de fijar TZ=America/Lima
 * en el entorno — son correctas bajo cualquier huso, incluido UTC-5.
 */
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
    // Un "YYYY-MM-DD" parseado con el constructor directo de Date es, por
    // especificación ECMA-402, siempre medianoche UTC — esta instancia de
    // tiempo es la misma sin importar el huso de la máquina que ejecuta la
    // prueba. Al proyectarla explícitamente sobre America/Lima (UTC-5),
    // retrocede al día calendario anterior: el defecto que reportó CP-RF31-01.
    const fechaBuggy = new Date('2026-09-11');
    const renderizadoBuggy = fechaBuggy.toLocaleDateString('es-PE', {
      day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Lima',
    });
    expect(renderizadoBuggy).toBe('10/09/2026');
  });
});
