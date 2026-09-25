const UNIDADES = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
const ESPECIALES = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
const DECENAS = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

function convertirDecenas(n: number): string {
  if (n < 10) return UNIDADES[n];
  if (n < 20) return ESPECIALES[n - 10];
  const decena = Math.floor(n / 10);
  const unidad = n % 10;
  if (decena === 2) return unidad === 0 ? 'VEINTE' : `VEINTI${UNIDADES[unidad].toLowerCase() === 'un' ? 'ÚN' : UNIDADES[unidad]}`;
  if (unidad === 0) return DECENAS[decena];
  return `${DECENAS[decena]} Y ${UNIDADES[unidad]}`;
}

function convertirCentenas(n: number): string {
  if (n === 100) return 'CIEN';
  const centena = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (centena > 0) partes.push(CENTENAS[centena]);
  if (resto > 0) partes.push(convertirDecenas(resto));
  return partes.join(' ');
}

function convertirEntero(n: number): string {
  if (n === 0) return 'CERO';
  if (n < 1000) return convertirCentenas(n);
  if (n < 1_000_000) {
    const miles = Math.floor(n / 1000);
    const resto = n % 1000;
    const prefijoMiles = miles === 1 ? 'MIL' : `${convertirCentenas(miles)} MIL`;
    return resto > 0 ? `${prefijoMiles} ${convertirCentenas(resto)}` : prefijoMiles;
  }
  const millones = Math.floor(n / 1_000_000);
  const resto = n % 1_000_000;
  const prefijoMillones = millones === 1 ? 'UN MILLÓN' : `${convertirEntero(millones)} MILLONES`;
  return resto > 0 ? `${prefijoMillones} ${convertirEntero(resto)}` : prefijoMillones;
}

export function montoEnLetrasSoles(monto: number): string {
  const valorAbsoluto = Math.abs(monto ?? 0);
  const parteEntera = Math.floor(valorAbsoluto);
  const centavos = Math.round((valorAbsoluto - parteEntera) * 100);
  const soles = parteEntera === 1 ? 'SOL' : 'SOLES';
  return `${convertirEntero(parteEntera)} CON ${String(centavos).padStart(2, '0')}/100 ${soles}`;
}
