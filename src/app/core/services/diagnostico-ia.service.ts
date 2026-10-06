import { HttpClient, HttpContext, HttpDownloadProgressEvent, HttpEventType } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SseEvento } from '../../models/response/diagnostico-ia-response';
import { SKIP_GLOBAL_LOADING } from '../interceptors/api.interceptor';

@Injectable({ providedIn: 'root' })
export class DiagnosticoIaService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/ia/diagnostico`;

  /** La consulta pasa por el servidor de la clínica, que comprueba la autorización del titular antes de enviarla a la IA. */
  analizarStream(formData: FormData): Observable<SseEvento> {
    return new Observable(observer => {
      let procesado = 0;
      let pendiente = '';

      const emitir = (texto: string): void => {
        pendiente += texto;
        const lineas = pendiente.split('\n');
        pendiente = lineas.pop() ?? '';
        for (const linea of lineas) {
          if (!linea.startsWith('data: ')) continue;
          try {
            const evento = JSON.parse(linea.slice(6)) as SseEvento;
            observer.next(evento);
            if (evento.type === 'done') observer.complete();
          } catch {}
        }
      };

      const suscripcion = this.http.post(this.url, formData, {
        observe: 'events',
        responseType: 'text',
        reportProgress: true,
        context: new HttpContext().set(SKIP_GLOBAL_LOADING, true),
      }).subscribe({
        next: evento => {
          if (evento.type === HttpEventType.DownloadProgress) {
            const parcial = (evento as HttpDownloadProgressEvent).partialText ?? '';
            emitir(parcial.slice(procesado));
            procesado = parcial.length;
          } else if (evento.type === HttpEventType.Response) {
            const total = evento.body ?? '';
            emitir(total.slice(procesado) + '\n');
            observer.complete();
          }
        },
        error: error => observer.error(error),
        complete: () => observer.complete(),
      });

      return () => suscripcion.unsubscribe();
    });
  }
}
