import { memoPorObjeto } from './memo-por-objeto';

describe('memoPorObjeto', () => {
  it('calcula una sola vez por objeto y devuelve el mismo resultado', () => {
    let llamadas = 0;
    const doble = memoPorObjeto((o: { n: number }) => { llamadas++; return [o.n, o.n]; });
    const objeto = { n: 2 };

    const primero = doble(objeto);
    const segundo = doble(objeto);

    expect(llamadas).toBe(1);
    expect(segundo).toBe(primero);
  });

  it('guarda un resultado distinto para cada objeto', () => {
    let llamadas = 0;
    const doble = memoPorObjeto((o: { n: number }) => { llamadas++; return o.n * 2; });

    expect(doble({ n: 1 })).toBe(2);
    expect(doble({ n: 5 })).toBe(10);
    expect(llamadas).toBe(2);
  });

  it('recalcula cuando cambia la firma del objeto', () => {
    let llamadas = 0;
    const largo = memoPorObjeto((o: { texto: string }) => { llamadas++; return o.texto.length; }, o => o.texto);
    const objeto = { texto: 'abc' };

    expect(largo(objeto)).toBe(3);
    expect(largo(objeto)).toBe(3);
    objeto.texto = 'abcde';

    expect(largo(objeto)).toBe(5);
    expect(llamadas).toBe(2);
  });

  it('conserva el resultado mientras la firma no cambie, aunque cambie otra propiedad', () => {
    let llamadas = 0;
    const etiqueta = memoPorObjeto((o: { id: number; nota: string }) => { llamadas++; return 'n' + o.id; }, o => o.id);
    const objeto = { id: 1, nota: 'a' };

    etiqueta(objeto);
    objeto.nota = 'b';
    etiqueta(objeto);

    expect(llamadas).toBe(1);
  });

  it('un resultado undefined también se guarda', () => {
    let llamadas = 0;
    const nada = memoPorObjeto((_: object) => { llamadas++; return undefined; });
    const objeto = {};

    nada(objeto);
    nada(objeto);

    expect(llamadas).toBe(1);
  });
});
