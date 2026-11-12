import { of } from 'rxjs';
import { ApiResponse } from '../../models/response/api-response';
import { Page } from '../../models/response/page';
import { leerTodasLasPaginas } from './leer-todas-las-paginas';

describe('leerTodasLasPaginas', () => {
  const pagina = (contenido: number[], totalPages: number): ApiResponse<Page<number>> =>
    ({ success: true, message: '', data: { content: contenido, totalPages } as Page<number> }) as ApiResponse<Page<number>>;

  it('con una sola página hace una sola petición', done => {
    const pedidas: number[] = [];

    leerTodasLasPaginas<number>(n => { pedidas.push(n); return of(pagina([1, 2], 1)); }).subscribe(todos => {
      expect(todos).toEqual([1, 2]);
      expect(pedidas).toEqual([0]);
      done();
    });
  });

  it('une todas las páginas en orden', done => {
    const paginas = [pagina([1, 2], 3), pagina([3, 4], 3), pagina([5], 3)];
    const pedidas: number[] = [];

    leerTodasLasPaginas<number>(n => { pedidas.push(n); return of(paginas[n]); }).subscribe(todos => {
      expect(todos).toEqual([1, 2, 3, 4, 5]);
      expect(pedidas).toEqual([0, 1, 2]);
      done();
    });
  });

  it('una lista vacía devuelve un arreglo vacío', done => {
    leerTodasLasPaginas<number>(() => of(pagina([], 0))).subscribe(todos => {
      expect(todos).toEqual([]);
      done();
    });
  });

  it('si el servidor no informa el total de páginas se queda con la primera', done => {
    const sinTotal = { success: true, message: '', data: { content: [7] } } as unknown as ApiResponse<Page<number>>;

    leerTodasLasPaginas<number>(() => of(sinTotal)).subscribe(todos => {
      expect(todos).toEqual([7]);
      done();
    });
  });
});
