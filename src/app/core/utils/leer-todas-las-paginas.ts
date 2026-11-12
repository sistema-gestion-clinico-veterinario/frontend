import { Observable, forkJoin, map, of, switchMap } from 'rxjs';
import { ApiResponse } from '../../models/response/api-response';
import { Page } from '../../models/response/page';

export function leerTodasLasPaginas<T>(pedir: (pagina: number) => Observable<ApiResponse<Page<T>>>): Observable<T[]> {
  return pedir(0).pipe(
    switchMap(primera => {
      const totalDePaginas = primera.data.totalPages ?? 1;
      if (totalDePaginas <= 1) {
        return of(primera.data.content ?? []);
      }
      const siguientes = Array.from({ length: totalDePaginas - 1 }, (_, indice) => pedir(indice + 1));
      return forkJoin(siguientes).pipe(
        map(paginas => [primera, ...paginas].flatMap(respuesta => respuesta.data.content ?? []))
      );
    })
  );
}
