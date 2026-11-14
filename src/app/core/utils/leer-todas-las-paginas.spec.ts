import { Observable, defer, finalize, map, of, throwError, timer } from 'rxjs';
import { ApiResponse } from '../../models/response/api-response';
import { Page } from '../../models/response/page';
import { leerPaginas, leerTodasLasPaginas } from './leer-todas-las-paginas';

type Respuesta = ApiResponse<Page<number>>;

const envolver = (data: unknown): Respuesta => ({ success: true, message: '', data }) as Respuesta;

const paginaDelServidor = (contenido: number[], totalPages: number): Respuesta =>
  envolver({ content: contenido, page: { size: contenido.length, number: 0, totalElements: contenido.length * totalPages, totalPages } });

const paginaConForma = (contenido: number[], totalPages: number): Respuesta =>
  envolver({ content: contenido, totalPages });

function servidorLento(totalPages: number, demoraMs: (pagina: number) => number = () => 2) {
  const estado = { pedidas: [] as number[], enVuelo: 0, maximoEnVuelo: 0 };
  const pedir = (pagina: number): Observable<Respuesta> => defer(() => {
    estado.pedidas.push(pagina);
    estado.enVuelo++;
    estado.maximoEnVuelo = Math.max(estado.maximoEnVuelo, estado.enVuelo);
    let liberada = false;
    const liberar = () => {
      if (liberada) return;
      liberada = true;
      estado.enVuelo--;
    };
    return timer(demoraMs(pagina)).pipe(
      map(() => {
        liberar();
        return paginaDelServidor([pagina * 10, pagina * 10 + 1], totalPages);
      }),
      finalize(liberar)
    );
  });
  return { estado, pedir };
}

describe('leerPaginas', () => {
  it('avisa que truncó cuando el servidor tiene más páginas que el tope', done => {
    const { pedir } = servidorLento(50, () => 0);

    leerPaginas<number>(pedir, { maximoPaginas: 10 }).subscribe(lectura => {
      expect(lectura.truncado).toBeTrue();
      expect(lectura.elementos.length).toBe(20);
      done();
    });
  });

  it('no avisa cuando cabe justo en el tope', done => {
    const { pedir } = servidorLento(10, () => 0);

    leerPaginas<number>(pedir, { maximoPaginas: 10 }).subscribe(lectura => {
      expect(lectura.truncado).toBeFalse();
      expect(lectura.elementos.length).toBe(20);
      done();
    });
  });

  it('no avisa con una sola página', done => {
    leerPaginas<number>(() => of(paginaDelServidor([1], 1))).subscribe(lectura => {
      expect(lectura).toEqual({ elementos: [1], truncado: false });
      done();
    });
  });

  it('un tope menor a uno se trata como uno', done => {
    const { estado, pedir } = servidorLento(8, () => 0);

    leerPaginas<number>(pedir, { maximoPaginas: 0 }).subscribe(lectura => {
      expect(estado.pedidas).toEqual([0]);
      expect(lectura.truncado).toBeTrue();
      done();
    });
  });
});

describe('leerTodasLasPaginas', () => {
  it('con una sola página hace una sola petición', done => {
    const pedidas: number[] = [];

    leerTodasLasPaginas<number>(n => { pedidas.push(n); return of(paginaDelServidor([1, 2], 1)); }).subscribe(todos => {
      expect(todos).toEqual([1, 2]);
      expect(pedidas).toEqual([0]);
      done();
    });
  });

  it('lee la forma real del servidor: el total está dentro de «page»', done => {
    const paginas = [paginaDelServidor([1, 2], 3), paginaDelServidor([3, 4], 3), paginaDelServidor([5], 3)];
    const pedidas: number[] = [];

    leerTodasLasPaginas<number>(n => { pedidas.push(n); return of(paginas[n]); }).subscribe(todos => {
      expect(todos).toEqual([1, 2, 3, 4, 5]);
      expect(pedidas.sort()).toEqual([0, 1, 2]);
      done();
    });
  });

  it('también acepta la forma antigua con el total al nivel de la página', done => {
    const paginas = [paginaConForma([1, 2], 2), paginaConForma([3], 2)];

    leerTodasLasPaginas<number>(n => of(paginas[n])).subscribe(todos => {
      expect(todos).toEqual([1, 2, 3]);
      done();
    });
  });

  it('si vienen las dos formas manda la de «page»', done => {
    const ambas = envolver({ content: [1], totalPages: 1, page: { totalPages: 2 } });
    const segunda = paginaDelServidor([2], 2);

    leerTodasLasPaginas<number>(n => of(n === 0 ? ambas : segunda)).subscribe(todos => {
      expect(todos).toEqual([1, 2]);
      done();
    });
  });

  it('una lista vacía devuelve un arreglo vacío', done => {
    leerTodasLasPaginas<number>(() => of(paginaDelServidor([], 0))).subscribe(todos => {
      expect(todos).toEqual([]);
      done();
    });
  });

  it('si el servidor no informa el total de páginas se queda con la primera', done => {
    leerTodasLasPaginas<number>(() => of(envolver({ content: [7] }))).subscribe(todos => {
      expect(todos).toEqual([7]);
      done();
    });
  });

  describe('con muchas páginas', () => {
    it('nunca tiene más de 3 peticiones a la vez', done => {
      const { estado, pedir } = servidorLento(40);

      leerTodasLasPaginas<number>(pedir).subscribe(todos => {
        expect(todos.length).toBe(80);
        expect(estado.maximoEnVuelo).toBe(3);
        done();
      });
    });

    it('respeta la concurrencia que se le pida', done => {
      const { estado, pedir } = servidorLento(20);

      leerTodasLasPaginas<number>(pedir, { concurrencia: 1 }).subscribe(() => {
        expect(estado.maximoEnVuelo).toBe(1);
        done();
      });
    });

    it('conserva el orden aunque las páginas lleguen desordenadas', done => {
      const { pedir } = servidorLento(6, pagina => (6 - pagina) * 4);

      leerTodasLasPaginas<number>(pedir).subscribe(todos => {
        expect(todos).toEqual([0, 1, 10, 11, 20, 21, 30, 31, 40, 41, 50, 51]);
        done();
      });
    });

    it('se detiene en el tope de páginas y no pide el resto', done => {
      const { estado, pedir } = servidorLento(500);

      leerTodasLasPaginas<number>(pedir, { maximoPaginas: 5 }).subscribe(todos => {
        expect(estado.pedidas.length).toBe(5);
        expect(todos.length).toBe(10);
        done();
      });
    });

    it('por defecto no pasa de 200 páginas aunque el servidor tenga miles', done => {
      const { estado, pedir } = servidorLento(5000, () => 0);

      leerTodasLasPaginas<number>(pedir).subscribe(todos => {
        expect(estado.pedidas.length).toBe(200);
        expect(todos.length).toBe(400);
        done();
      });
    });

    it('lee 20 mil elementos en un tiempo razonable', done => {
      const paginas = Array.from({ length: 200 }, (_, pagina) =>
        paginaDelServidor(Array.from({ length: 100 }, (_, i) => pagina * 100 + i), 200));
      const inicio = performance.now();

      leerTodasLasPaginas<number>(n => of(paginas[n])).subscribe(todos => {
        expect(todos.length).toBe(20000);
        expect(todos[0]).toBe(0);
        expect(todos[19999]).toBe(19999);
        expect(performance.now() - inicio).toBeLessThan(1000);
        done();
      });
    });

    it('si una página falla propaga el error y deja de pedir más', done => {
      const pedidas: number[] = [];
      const pedir = (pagina: number): Observable<Respuesta> => {
        pedidas.push(pagina);
        if (pagina === 0) return of(paginaDelServidor([0], 100));
        if (pagina === 2) return throwError(() => new Error('falló la página 2'));
        return timer(5).pipe(map(() => paginaDelServidor([pagina], 100)));
      };

      leerTodasLasPaginas<number>(pedir).subscribe({
        error: error => {
          expect(error.message).toBe('falló la página 2');
          setTimeout(() => {
            expect(pedidas.length).toBeLessThan(10);
            done();
          }, 60);
        }
      });
    });

    it('al cancelar la suscripción deja de pedir páginas', done => {
      const { estado, pedir } = servidorLento(100, () => 10);

      const suscripcion = leerTodasLasPaginas<number>(pedir).subscribe();
      setTimeout(() => {
        suscripcion.unsubscribe();
        const pedidasAlCancelar = estado.pedidas.length;
        setTimeout(() => {
          expect(estado.pedidas.length).toBe(pedidasAlCancelar);
          expect(estado.pedidas.length).toBeLessThan(100);
          done();
        }, 60);
      }, 35);
    });
  });
});
