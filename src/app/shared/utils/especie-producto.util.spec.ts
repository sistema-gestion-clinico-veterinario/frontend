import { etiquetaAplicacionEspecie, productoCompatibleConEspecie } from './especie-producto.util';

describe('etiquetaAplicacionEspecie', () => {
  it('etiqueta los productos de uso general', () => {
    const etiqueta = etiquetaAplicacionEspecie('USO_GENERAL', []);

    expect(etiqueta?.texto).toBe('Uso general');
  });

  it('describe las especies en plural con la conjunción adecuada', () => {
    expect(etiquetaAplicacionEspecie('ESPECIES_ESPECIFICAS', ['PERRO'])?.texto)
      .toBe('Para: perros');
    expect(etiquetaAplicacionEspecie('ESPECIES_ESPECIFICAS', ['PERRO', 'GATO'])?.texto)
      .toBe('Para: perros y gatos');
    expect(etiquetaAplicacionEspecie('ESPECIES_ESPECIFICAS', ['PERRO', 'GATO', 'AVE'])?.texto)
      .toBe('Para: perros, gatos y aves');
  });

  it('no etiqueta los productos antiguos sin clasificar', () => {
    expect(etiquetaAplicacionEspecie('NO_ESPECIFICADO', [])).toBeNull();
    expect(etiquetaAplicacionEspecie(null, [])).toBeNull();
    expect(etiquetaAplicacionEspecie(undefined, [])).toBeNull();
  });

  it('avisa cuando un producto de especies específicas quedó sin especies', () => {
    expect(etiquetaAplicacionEspecie('ESPECIES_ESPECIFICAS', [])?.texto).toBe('Sin especies');
  });
});

describe('productoCompatibleConEspecie', () => {
  it('acepta productos de uso general para cualquier especie', () => {
    expect(productoCompatibleConEspecie('USO_GENERAL', [], 'GATO')).toBeTrue();
  });

  it('acepta un producto específico cuando incluye la especie de la mascota', () => {
    expect(productoCompatibleConEspecie('ESPECIES_ESPECIFICAS', ['PERRO', 'GATO'], 'GATO')).toBeTrue();
  });

  it('rechaza un producto específico destinado a otra especie', () => {
    expect(productoCompatibleConEspecie('ESPECIES_ESPECIFICAS', ['PERRO'], 'AVE')).toBeFalse();
  });
});
