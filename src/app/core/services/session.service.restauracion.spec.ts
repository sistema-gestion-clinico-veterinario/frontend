import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, Subject, TimeoutError, defer, of, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { NavigationService } from './navigation.service';
import { AuthStore } from '../../store/auth.store';
import { LoadingStore } from '../../store/loading.store';
import { ConnectionStatusService, MENSAJE_RECONECTANDO } from './connection-status.service';
import { ESPERA_MAXIMA_MS, ESPERAS_DE_REINTENTO_MS, MAXIMO_DE_REINTENTOS } from '../http/fallo-transitorio';

const sesion = (companySlug = 'clinica-a') => ({
  success: true,
  message: 'ok',
  data: {
    roles: ['ROLE_ADMIN'], assignedRoles: ['ROLE_ADMIN'], availableRoles: [], activeRoleId: 1, activeRoleName: 'ROLE_ADMIN',
    activeRoleScope: 'STAFF', activeRolePurpose: 'COMPANY_ADMIN', permissionVersion: 1, companyId: 7, companyName: 'Clínica A',
    companySlug, nombreCompleto: 'Ana', userType: 'STAFF', empleadoId: null, passwordChanged: true, menu: [],
  },
} as any);

const caida = (status: number) => new HttpErrorResponse({ status, statusText: 'x' });

describe('SessionService - restauración de la sesión al abrir la página con el servidor caído', () => {
  let servicio: SessionService;
  let authService: jasmine.SpyObj<AuthService>;
  let authStore: InstanceType<typeof AuthStore>;
  let conexion: ConnectionStatusService;
  let carga: InstanceType<typeof LoadingStore>;
  let intentos: number;

  // Como una petición HTTP: cada suscripción es un intento nuevo y puede responder distinto.
  const respuestas = (...lista: Observable<any>[]) => {
    intentos = 0;
    authService.refreshToken.and.returnValue(defer(() => lista[Math.min(intentos++, lista.length - 1)]));
  };

  beforeEach(() => {
    localStorage.clear();
    intentos = 0;
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['refreshToken']);
    const navegacion = jasmine.createSpyObj<NavigationService>('NavigationService', ['getEffectiveNavigation']);
    navegacion.getEffectiveNavigation.and.returnValue(of({ success: true, message: 'ok', data: [] }));
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: authService }, { provide: NavigationService, useValue: navegacion }],
    });
    servicio = TestBed.inject(SessionService);
    authStore = TestBed.inject(AuthStore);
    conexion = TestBed.inject(ConnectionStatusService);
    carga = TestBed.inject(LoadingStore);
  });

  it('un 503 al restaurar la sesión no cierra la sesión: reintenta y, al responder, autentica', fakeAsync(() => {
    spyOn(authStore, 'logout').and.callThrough();
    respuestas(throwError(() => caida(503)), of(sesion()));
    let resultado: boolean | undefined;

    servicio.initialize('clinica-a').subscribe((r) => (resultado = r));

    expect(resultado).toBeUndefined();
    expect(intentos).toBe(1);
    tick(ESPERAS_DE_REINTENTO_MS[0]);

    expect(intentos).toBe(2);
    expect(resultado).toBeTrue();
    expect(authStore.sessionStatus()).toBe('authenticated');
    expect(authStore.logout).not.toHaveBeenCalled();
    tick(3000);
  }));

  it('mientras reintenta muestra «Reconectando…» y la pantalla de carga; al terminar los quita', fakeAsync(() => {
    const segundoIntento = new Subject<any>();
    respuestas(throwError(() => caida(503)), segundoIntento.asObservable());

    servicio.initialize('clinica-a').subscribe();

    expect(conexion.mensaje()).toBe(MENSAJE_RECONECTANDO);
    expect(carga.isLoading()).toBeTrue();
    tick(ESPERAS_DE_REINTENTO_MS[0]);
    segundoIntento.next(sesion());
    segundoIntento.complete();

    expect(carga.isLoading()).toBeFalse();
    expect(conexion.estado()).toBe('restablecida');
    tick(3000);
  }));

  it('sin respuesta de red (estado 0), con tiempo agotado o con 504 también reintenta', fakeAsync(() => {
    spyOn(authStore, 'logout').and.callThrough();
    respuestas(throwError(() => caida(0)), throwError(() => new TimeoutError()), throwError(() => caida(504)), of(sesion()));
    let resultado: boolean | undefined;

    servicio.initialize('clinica-a').subscribe((r) => (resultado = r));
    tick(ESPERAS_DE_REINTENTO_MS[0]);
    tick(ESPERAS_DE_REINTENTO_MS[1]);
    tick(ESPERAS_DE_REINTENTO_MS[2]);

    expect(intentos).toBe(4);
    expect(resultado).toBeTrue();
    expect(authStore.logout).not.toHaveBeenCalled();
    tick(3000);
  }));

  it('varias pantallas que piden la sesión a la vez comparten un solo reintento', fakeAsync(() => {
    respuestas(throwError(() => caida(503)), of(sesion()));
    const resultados: boolean[] = [];

    servicio.initialize('clinica-a').subscribe((r) => resultados.push(r));
    servicio.initialize('clinica-a').subscribe((r) => resultados.push(r));
    tick(ESPERAS_DE_REINTENTO_MS[0]);

    expect(intentos).toBe(2);
    expect(resultados).toEqual([true, true]);
    tick(3000);
  }));

  it('un rechazo real (401) sigue cerrando la sesión y no se reintenta', fakeAsync(() => {
    spyOn(authStore, 'logout').and.callThrough();
    respuestas(throwError(() => caida(401)));
    let resultado: boolean | undefined;

    servicio.initialize('clinica-a').subscribe((r) => (resultado = r));
    tick(ESPERA_MAXIMA_MS);

    expect(resultado).toBeFalse();
    expect(authStore.logout).toHaveBeenCalledTimes(1);
    expect(intentos).toBe(1);
    expect(conexion.estado()).toBe('conectado');
  }));

  it('un error de servidor que no es de indisponibilidad (500) sigue cerrando la sesión', fakeAsync(() => {
    spyOn(authStore, 'logout').and.callThrough();
    respuestas(throwError(() => caida(500)));

    servicio.initialize('clinica-a').subscribe();

    expect(authStore.logout).toHaveBeenCalledTimes(1);
    expect(intentos).toBe(1);
  }));

  it('si el servidor no vuelve tras el máximo de reintentos, no cierra la sesión local ni vuelve a insistir en esta página', fakeAsync(() => {
    spyOn(authStore, 'logout').and.callThrough();
    respuestas(throwError(() => caida(503)));
    let resultado: boolean | undefined;

    servicio.initialize('clinica-a').subscribe((r) => (resultado = r));
    for (let i = 0; i < MAXIMO_DE_REINTENTOS; i++) {
      tick(ESPERA_MAXIMA_MS);
    }

    expect(resultado).toBeFalse();
    expect(intentos).toBe(MAXIMO_DE_REINTENTOS + 1);
    expect(authStore.logout).not.toHaveBeenCalled();
    expect(conexion.estado()).toBe('conectado');
    expect(carga.isLoading()).toBeFalse();

    let segundo: boolean | undefined;
    servicio.initialize('clinica-a').subscribe((r) => (segundo = r));
    expect(segundo).toBeFalse();
    expect(intentos).toBe(MAXIMO_DE_REINTENTOS + 1);
  }));

  it('al iniciar sesión de nuevo vuelve a poder restaurarse la sesión', fakeAsync(() => {
    respuestas(throwError(() => caida(503)));
    servicio.initialize('clinica-a').subscribe();
    for (let i = 0; i < MAXIMO_DE_REINTENTOS; i++) {
      tick(ESPERA_MAXIMA_MS);
    }

    servicio.establish(sesion().data);
    let resultado: boolean | undefined;
    servicio.initialize('clinica-a').subscribe((r) => (resultado = r));

    expect(authStore.sessionStatus()).toBe('authenticated');
    expect(resultado).toBeTrue();
  }));
});
