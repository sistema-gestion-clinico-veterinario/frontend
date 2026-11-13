import { TestBed } from '@angular/core/testing';
import { ErrorHandler } from '@angular/core';
import { Router } from '@angular/router';
import { appConfig } from '../../app.config';
import { ManejadorErroresGlobal } from './manejador-errores-global';
import { VersionNuevaService, esErrorDeCargaDeFragmento } from './version-nueva.service';

describe('esErrorDeCargaDeFragmento', () => {
  const casos: Array<[string, unknown]> = [
    ['Chrome y Edge', new TypeError('Failed to fetch dynamically imported module: https://app.test/chunk-ABCDEFGH.js')],
    ['Firefox', new TypeError('error loading dynamically imported module: https://app.test/chunk-ABCDEFGH.js')],
    ['Safari', new TypeError('Importing a module script failed.')],
    ['módulo con tipo MIME incorrecto', new TypeError('Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type of "text/html".')],
    ['webpack', Object.assign(new Error('Loading chunk 12 failed.'), { name: 'ChunkLoadError' })],
    ['solo por nombre', { name: 'ChunkLoadError' }],
    ['texto', 'Failed to fetch dynamically imported module'],
    ['promesa rechazada de zone.js', { message: 'Uncaught (in promise)', rejection: new TypeError('Failed to fetch dynamically imported module: https://app.test/chunk-A.js') }],
    ['causa interna', { message: 'NG04002', cause: new TypeError('Importing a module script failed.') }]
  ];

  for (const [nombre, error] of casos) {
    it(`reconoce el error de ${nombre}`, () => {
      expect(esErrorDeCargaDeFragmento(error)).toBeTrue();
    });
  }

  const otros: Array<[string, unknown]> = [
    ['null', null],
    ['undefined', undefined],
    ['un número', 404],
    ['un error corriente', new Error('Cannot read properties of undefined')],
    ['un error de red del servidor', { status: 0, message: 'Http failure response for https://api.test/x: 0 Unknown Error' }],
    ['una cadena distinta', 'No se pudo guardar']
  ];

  for (const [nombre, error] of otros) {
    it(`no confunde ${nombre}`, () => {
      expect(esErrorDeCargaDeFragmento(error)).toBeFalse();
    });
  }

  it('no se queda en un ciclo con causas que se refieren a sí mismas', () => {
    const circular: { cause?: unknown; message: string } = { message: 'otro' };
    circular.cause = circular;

    expect(esErrorDeCargaDeFragmento(circular)).toBeFalse();
  });
});

describe('VersionNuevaService', () => {
  let servicio: VersionNuevaService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    servicio = TestBed.inject(VersionNuevaService);
  });

  it('empieza sin versión nueva', () => {
    expect(servicio.disponible()).toBeFalse();
  });

  it('un error corriente no activa el aviso', () => {
    expect(servicio.registrarError(new Error('otro'))).toBeFalse();
    expect(servicio.disponible()).toBeFalse();
  });

  it('un error de carga de fragmento activa el aviso', () => {
    expect(servicio.registrarError(new TypeError('Failed to fetch dynamically imported module: x'))).toBeTrue();
    expect(servicio.disponible()).toBeTrue();
  });

  it('el aviso se mantiene aunque lleguen después errores corrientes', () => {
    servicio.registrarError(new TypeError('Importing a module script failed.'));
    servicio.registrarError(new Error('otro'));

    expect(servicio.disponible()).toBeTrue();
  });
});

describe('ManejadorErroresGlobal', () => {
  let manejador: ErrorHandler;
  let version: VersionNuevaService;
  let consola: jasmine.Spy;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: ErrorHandler, useClass: ManejadorErroresGlobal }] });
    manejador = TestBed.inject(ErrorHandler);
    version = TestBed.inject(VersionNuevaService);
    consola = spyOn(console, 'error');
  });

  it('activa el aviso con un error de carga y sigue registrándolo en la consola', () => {
    manejador.handleError(new TypeError('Failed to fetch dynamically imported module: x'));

    expect(version.disponible()).toBeTrue();
    expect(consola).toHaveBeenCalled();
  });

  it('con un error corriente solo lo registra en la consola', () => {
    manejador.handleError(new Error('otro'));

    expect(version.disponible()).toBeFalse();
    expect(consola).toHaveBeenCalled();
  });
});

describe('Configuración de la aplicación ante un fragmento que no carga', () => {
  it('una ruta cuyo fragmento no se descarga activa el aviso de versión nueva', async () => {
    TestBed.configureTestingModule({ providers: [...appConfig.providers] });
    spyOn(console, 'error');
    const router = TestBed.inject(Router);
    router.resetConfig([{
      path: 'dashboard',
      loadComponent: () => Promise.reject(new TypeError('Failed to fetch dynamically imported module: https://app.test/chunk-ABCDEFGH.js'))
    }]);

    await router.navigateByUrl('/dashboard').catch(() => undefined);

    expect(TestBed.inject(VersionNuevaService).disponible()).toBeTrue();
  });

  it('un error de otro tipo al cargar la ruta no activa el aviso', async () => {
    TestBed.configureTestingModule({ providers: [...appConfig.providers] });
    spyOn(console, 'error');
    const router = TestBed.inject(Router);
    router.resetConfig([{ path: 'dashboard', loadComponent: () => Promise.reject(new Error('fallo distinto')) }]);

    await router.navigateByUrl('/dashboard').catch(() => undefined);

    expect(TestBed.inject(VersionNuevaService).disponible()).toBeFalse();
  });
});
