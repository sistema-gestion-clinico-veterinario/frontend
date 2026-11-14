import { Observable, from, map, mergeMap, of, switchMap, toArray } from 'rxjs';
import { ApiResponse } from '../../models/response/api-response';
import { Page } from '../../models/response/page';

const CONCURRENCIA_POR_DEFECTO = 3;
const MAXIMO_PAGINAS_POR_DEFECTO = 200;

export interface OpcionesLecturaPaginas {
  concurrencia?: number;
  maximoPaginas?: number;
}

export interface LecturaPaginas<T> {
  elementos: T[];
  truncado: boolean;
}

const totalDePaginas = (pagina: Page<unknown>): number => pagina.page?.totalPages ?? pagina.totalPages ?? 1;

export function leerPaginas<T>(
  pedir: (pagina: number) => Observable<ApiResponse<Page<T>>>,
  opciones: OpcionesLecturaPaginas = {}
): Observable<LecturaPaginas<T>> {
  const concurrencia = Math.max(1, opciones.concurrencia ?? CONCURRENCIA_POR_DEFECTO);
  const maximoPaginas = Math.max(1, opciones.maximoPaginas ?? MAXIMO_PAGINAS_POR_DEFECTO);

  return pedir(0).pipe(
    switchMap(primera => {
      const total = totalDePaginas(primera.data);
      const hasta = Math.min(total, maximoPaginas);
      const truncado = total > hasta;
      const contenidoInicial = primera.data.content ?? [];
      if (hasta <= 1) {
        return of({ elementos: contenidoInicial, truncado });
      }

      const siguientes = Array.from({ length: hasta - 1 }, (_, indice) => indice + 1);
      return from(siguientes).pipe(
        mergeMap(
          pagina => pedir(pagina).pipe(map(respuesta => ({ pagina, contenido: respuesta.data.content ?? [] }))),
          concurrencia
        ),
        toArray(),
        map(resto => ({
          elementos: [...contenidoInicial, ...resto.sort((a, b) => a.pagina - b.pagina).flatMap(parte => parte.contenido)],
          truncado
        }))
      );
    })
  );
}

export function leerTodasLasPaginas<T>(
  pedir: (pagina: number) => Observable<ApiResponse<Page<T>>>,
  opciones?: OpcionesLecturaPaginas
): Observable<T[]> {
  return leerPaginas(pedir, opciones).pipe(map(lectura => lectura.elementos));
}
