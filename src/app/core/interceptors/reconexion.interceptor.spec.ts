import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { HttpClient, HttpContext, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { ConnectionStatusService, MENSAJE_NO_GUARDADO } from '../services/connection-status.service';
import { SKIP_GLOBAL_LOADING } from './http-context.tokens';
import { ESPERA_MAXIMA_MS, ESPERAS_DE_REINTENTO_MS, MAXIMO_DE_REINTENTOS, reconexionInterceptor } from './reconexion.interceptor';

describe('reconexionInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let estado: ConnectionStatusService;
  const url = `${environment.apiUrl}/mascotas`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([reconexionInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    estado = TestBed.inject(ConnectionStatusService);
  });

  afterEach(() => controller.verify());

  it('una lectura que recibe 503 se reintenta sola y muestra «Reconectando…» hasta que responde', fakeAsync(() => {
    let respuesta: unknown;
    http.get(url).subscribe((r) => (respuesta = r));

    controller.expectOne(url).flush({}, { status: 503, statusText: 'Service Unavailable' });
    expect(estado.estado()).toBe('reconectando');

    tick(ESPERAS_DE_REINTENTO_MS[0]);
    controller.expectOne(url).flush({ ok: true });

    expect(respuesta).toEqual({ ok: true });
    expect(estado.estado()).toBe('restablecida');
    tick(3000);
  }));

  it('espera cada vez más entre reintentos', fakeAsync(() => {
    http.get(url).subscribe({ error: () => {} });
    const fallar = () => controller.expectOne(url).flush({}, { status: 503, statusText: 'x' });

    fallar();
    tick(ESPERAS_DE_REINTENTO_MS[0] - 1);
    controller.expectNone(url);
    tick(1);
    fallar();
    tick(ESPERAS_DE_REINTENTO_MS[1]);
    fallar();
    tick(ESPERAS_DE_REINTENTO_MS[2]);
    fallar();
    tick(ESPERA_MAXIMA_MS);
    controller.expectOne(url).flush({ ok: true });
    expect(estado.estado()).toBe('restablecida');
    tick(3000);
  }));

  it('respeta el Retry-After del servidor', fakeAsync(() => {
    http.get(url).subscribe();
    controller.expectOne(url).flush({}, { status: 503, statusText: 'x', headers: { 'Retry-After': '8' } });

    tick(7999);
    controller.expectNone(url);
    tick(1);
    controller.expectOne(url).flush({});
    expect(estado.estado()).toBe('restablecida');
    tick(3000);
  }));

  it('una petición sin respuesta de red (estado 0) también se reintenta', fakeAsync(() => {
    http.get(url).subscribe();
    controller.expectOne(url).error(new ProgressEvent('error'));

    tick(ESPERAS_DE_REINTENTO_MS[0]);
    controller.expectOne(url).flush({});
    expect(estado.estado()).toBe('restablecida');
    tick(3000);
  }));

  it('tras el máximo de reintentos entrega el error y quita el aviso', fakeAsync(() => {
    let error: HttpErrorResponse | undefined;
    http.get(url).subscribe({ error: (e) => (error = e) });

    for (let i = 0; i <= MAXIMO_DE_REINTENTOS; i++) {
      controller.expectOne(url).flush({}, { status: 503, statusText: 'x' });
      tick(ESPERA_MAXIMA_MS);
    }

    expect(error?.status).toBe(503);
    expect(estado.estado()).toBe('conectado');
  }));

  it('errores que no son de servidor no disponible no se reintentan: 400, 401, 404, 500', fakeAsync(() => {
    for (const status of [400, 401, 404, 500]) {
      let error: HttpErrorResponse | undefined;
      http.get(url).subscribe({ error: (e) => (error = e) });
      controller.expectOne(url).flush({}, { status, statusText: 'x' });

      expect(error?.status).toBe(status);
      expect(estado.estado()).toBe('conectado');
    }
    controller.expectNone(url);
  }));

  it('una escritura nunca se reintenta sola y avisa «No se guardó»', fakeAsync(() => {
    for (const metodo of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      let error: HttpErrorResponse | undefined;
      http.request(metodo, url, { body: {} }).subscribe({ error: (e) => (error = e) });
      controller.expectOne(url).flush({}, { status: 503, statusText: 'x' });

      expect(error?.status).toBe(503);
      expect(estado.mensaje()).toBe(MENSAJE_NO_GUARDADO);
      tick(ESPERA_MAXIMA_MS);
      controller.expectNone(url);
    }
  }));

  it('una escritura que falla por un error de datos no dice «No se guardó» por falta de conexión', fakeAsync(() => {
    http.post(url, {}).subscribe({ error: () => {} });
    controller.expectOne(url).flush({}, { status: 409, statusText: 'x' });

    expect(estado.mensaje()).toBeNull();
  }));

  it('las rutas de autenticación no muestran «No se guardó»', fakeAsync(() => {
    const login = `${environment.apiUrl}/auth/login`;
    http.post(login, {}).subscribe({ error: () => {} });
    controller.expectOne(login).flush({}, { status: 503, statusText: 'x' });

    expect(estado.mensaje()).toBeNull();
  }));

  it('las lecturas en segundo plano y las ajenas a la API no se reintentan', fakeAsync(() => {
    http.get(url, { context: new HttpContext().set(SKIP_GLOBAL_LOADING, true) }).subscribe({ error: () => {} });
    controller.expectOne(url).flush({}, { status: 503, statusText: 'x' });
    http.get('https://otro.example/api').subscribe({ error: () => {} });
    controller.expectOne('https://otro.example/api').flush({}, { status: 503, statusText: 'x' });

    tick(ESPERA_MAXIMA_MS);
    controller.expectNone(url);
    expect(estado.estado()).toBe('conectado');
  }));

  it('si la pantalla abandona la lectura, el reintento se cancela y el aviso se quita', fakeAsync(() => {
    const suscripcion = http.get(url).subscribe();
    controller.expectOne(url).flush({}, { status: 503, statusText: 'x' });
    expect(estado.estado()).toBe('reconectando');

    suscripcion.unsubscribe();
    tick(ESPERA_MAXIMA_MS);

    controller.expectNone(url);
    expect(estado.estado()).toBe('conectado');
  }));
});
