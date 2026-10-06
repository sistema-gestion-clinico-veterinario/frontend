import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { HttpEventType } from '@angular/common/http';
import { DiagnosticoIaService } from './diagnostico-ia.service';
import { SseEvento } from '../../models/response/diagnostico-ia-response';
import { environment } from '../../../environments/environment';

describe('DiagnosticoIaService', () => {
  let service: DiagnosticoIaService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(DiagnosticoIaService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  const linea = (evento: object) => `data: ${JSON.stringify(evento)}\n\n`;

  it('envía la consulta al servidor de la clínica y no directo al servicio de IA', () => {
    const formulario = new FormData();
    formulario.append('mascotaId', '7');

    service.analizarStream(formulario).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/ia/diagnostico`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBe(formulario);
    expect(req.request.url).not.toContain('railway');
    req.flush('');
  });

  it('entrega cada evento a medida que llega, aunque una línea llegue partida en dos', () => {
    const eventos: SseEvento[] = [];
    let completado = false;
    service.analizarStream(new FormData()).subscribe({ next: e => eventos.push(e), complete: () => (completado = true) });
    const req = httpMock.expectOne(`${environment.apiUrl}/ia/diagnostico`);

    const primero = linea({ type: 'meta', escenario: 'HC_solo', modelo: 'm' }) + 'data: {"type":"chunk","te';
    req.event({ type: HttpEventType.DownloadProgress, loaded: primero.length, partialText: primero } as any);
    expect(eventos.map(e => e.type)).toEqual(['meta']);

    const total = primero + 'xt":"Hola"}\n\n' + linea({ type: 'done' });
    req.event({ type: HttpEventType.DownloadProgress, loaded: total.length, partialText: total } as any);

    expect(eventos.map(e => e.type)).toEqual(['meta', 'chunk', 'done']);
    expect((eventos[1] as any).text).toBe('Hola');
    expect(completado).toBeTrue();
  });

  it('si la respuesta llega completa de una vez, también se procesa', () => {
    const eventos: SseEvento[] = [];
    service.analizarStream(new FormData()).subscribe(e => eventos.push(e));

    httpMock.expectOne(`${environment.apiUrl}/ia/diagnostico`)
      .flush(linea({ type: 'chunk', text: 'A' }) + linea({ type: 'done' }));

    expect(eventos.map(e => e.type)).toEqual(['chunk', 'done']);
  });

  it('el evento de error del servidor llega a la pantalla', () => {
    const eventos: SseEvento[] = [];
    service.analizarStream(new FormData()).subscribe(e => eventos.push(e));

    httpMock.expectOne(`${environment.apiUrl}/ia/diagnostico`).flush(linea({ type: 'error' }));

    expect(eventos).toEqual([{ type: 'error' }]);
  });

  it('propaga el rechazo del servidor cuando el titular no autorizó', () => {
    let error: any;
    service.analizarStream(new FormData()).subscribe({ error: e => (error = e) });

    httpMock.expectOne(`${environment.apiUrl}/ia/diagnostico`).flush(
      JSON.stringify({ success: false, message: 'x', data: { code: 'IA_SIN_AUTORIZACION' } }),
      { status: 403, statusText: 'Forbidden' });

    expect(error.status).toBe(403);
  });

  it('cancelar la suscripción cancela la petición', () => {
    const sub = service.analizarStream(new FormData()).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/ia/diagnostico`);

    sub.unsubscribe();

    expect(req.cancelled).toBeTrue();
  });
});
