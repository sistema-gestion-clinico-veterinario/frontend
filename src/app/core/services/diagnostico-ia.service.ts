import { Injectable, NgZone, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SseEvento } from '../../models/response/diagnostico-ia-response';

@Injectable({ providedIn: 'root' })
export class DiagnosticoIaService {
  private readonly zone   = inject(NgZone);
  private readonly iaUrl  = `${environment.iaUrl}/ia/diagnostico`;

  analizarStream(formData: FormData): Observable<SseEvento> {
    return new Observable(observer => {
      const ctrl = new AbortController();

      fetch(this.iaUrl, { method: 'POST', body: formData, signal: ctrl.signal })
        .then(res => {
          if (!res.ok) {
            observer.error(new Error(`Error ${res.status}`));
            return;
          }
          const reader  = res.body!.getReader();
          const decoder = new TextDecoder();
          let buffer    = '';

          const pump = (): void => {
            reader.read().then(({ done, value }) => {
              if (done) { this.zone.run(() => observer.complete()); return; }
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop()!;
              for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                try {
                  const evt = JSON.parse(line.slice(6)) as SseEvento;
                  this.zone.run(() => observer.next(evt));
                  if (evt.type === 'done') this.zone.run(() => observer.complete());
                } catch {}
              }
              pump();
            }).catch(err => this.zone.run(() => observer.error(err)));
          };
          pump();
        })
        .catch(err => {
          if ((err as DOMException).name !== 'AbortError') {
            this.zone.run(() => observer.error(err));
          }
        });

      return () => ctrl.abort();
    });
  }
}
