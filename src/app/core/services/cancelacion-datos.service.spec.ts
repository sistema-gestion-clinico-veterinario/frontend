import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CancelacionDatosService } from './cancelacion-datos.service';
import { environment } from '../../../environments/environment';

describe('CancelacionDatosService', () => {
  let servicio: CancelacionDatosService;
  let http: HttpTestingController;
  const titular = `${environment.apiUrl}/me/privacidad/cancelacion`;
  const admin = `${environment.apiUrl}/admin/privacidad/cancelaciones`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    servicio = TestBed.inject(CancelacionDatosService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('el titular consulta el estado de su solicitud', () => {
    servicio.estado().subscribe();

    const peticion = http.expectOne(titular);
    expect(peticion.request.method).toBe('GET');
    peticion.flush({ success: true, message: 'ok', data: null });
  });

  it('el titular pide el código con su contraseña', () => {
    servicio.pedirCodigo('Clave!1').subscribe();

    const peticion = http.expectOne(`${titular}/codigo`);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ password: 'Clave!1' });
    peticion.flush({ success: true, message: 'ok', data: { retryAfterSeconds: 60 } });
  });

  it('una cuenta sin contraseña pide el código sin enviarla', () => {
    servicio.pedirCodigo(null).subscribe();

    expect(http.expectOne(`${titular}/codigo`).request.body).toEqual({ password: null });
  });

  it('el titular registra su solicitud con el código y el motivo', () => {
    servicio.solicitar('123456', 'Ya no soy cliente').subscribe();

    const peticion = http.expectOne(titular);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ code: '123456', motivo: 'Ya no soy cliente' });
  });

  it('el administrador lista todas las solicitudes o filtra por estado', () => {
    servicio.listar().subscribe();
    http.expectOne(admin).flush({ success: true, message: 'ok', data: [] });

    servicio.listar('PENDIENTE').subscribe();
    http.expectOne(`${admin}?estado=PENDIENTE`).flush({ success: true, message: 'ok', data: [] });
  });

  it('el administrador registra a nombre del titular indicando cómo verificó su identidad', () => {
    servicio.registrar({ apoderadoId: 7, metodoVerificacion: 'Presentó su DNI', motivo: null }).subscribe();

    const peticion = http.expectOne(admin);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ apoderadoId: 7, metodoVerificacion: 'Presentó su DNI', motivo: null });
  });

  it('ejecutar y rechazar usan la solicitud indicada', () => {
    servicio.ejecutar(5).subscribe();
    expect(http.expectOne(`${admin}/5/ejecutar`).request.method).toBe('POST');

    servicio.rechazar(5, 'Hay una obligación legal de conservar').subscribe();
    const rechazo = http.expectOne(`${admin}/5/rechazar`);
    expect(rechazo.request.body).toEqual({ motivo: 'Hay una obligación legal de conservar' });
  });
});
