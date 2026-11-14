interface Entrada<V> {
  firma: unknown;
  valor: V;
}

export function memoPorObjeto<K extends object, V>(
  calcular: (clave: K) => V,
  firma: (clave: K) => unknown = () => undefined
): (clave: K) => V {
  const cache = new WeakMap<K, Entrada<V>>();
  return (clave: K) => {
    const actual = firma(clave);
    const guardada = cache.get(clave);
    if (guardada && Object.is(guardada.firma, actual)) return guardada.valor;
    const valor = calcular(clave);
    cache.set(clave, { firma: actual, valor });
    return valor;
  };
}
