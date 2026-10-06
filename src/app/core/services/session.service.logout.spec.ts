import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Observable, Subject, of } from 'rxjs';
import { ApiResponse } from '../../models/response/api-response';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { AuthStore } from '../../store/auth.store';
import { NavigationService } from './navigation.service';

const ok: ApiResponse<void> = { success: true, message: 'ok', data: undefined };

describe('SessionService - cierre de sesión', () => {
  let service: SessionService;
  let authService: jasmine.SpyObj<AuthService>;
  let authStore: InstanceType<typeof AuthStore>;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['logout', 'refreshToken']);
    const navigationService = jasmine.createSpyObj<NavigationService>('NavigationService', ['getEffectiveNavigation']);
    navigationService.getEffectiveNavigation.and.returnValue(of({ success: true, message: 'ok', data: [] }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: NavigationService, useValue: navigationService }
      ],
    });
    service = TestBed.inject(SessionService);
    authStore = TestBed.inject(AuthStore);
    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
    spyOn(authStore, 'logout').and.callThrough();
  });

  it('cierra la sesión local solo cuando el servidor confirma, y vuelve al login', () => {
    authService.logout.and.returnValue(of(ok));

    service.logout();

    expect(authService.logout).toHaveBeenCalledTimes(1);
    expect(authStore.logout).toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login', { replaceUrl: true });
    expect(service.logoutError()).toBeNull();
  });

  it('tras cerrar la cuenta limpia la sesión local, avisa a las otras pestañas y vuelve al login con el aviso', () => {
    service.closeLocalSession('aviso_de_prueba');

    expect(authStore.logout).toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login?authNotice=aviso_de_prueba', { replaceUrl: true });
  });

  it('sin aviso vuelve al login simple', () => {
    service.closeLocalSession();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/login', { replaceUrl: true });
  });

  it('si el servidor no responde reintenta una vez y, si sigue fallando, avisa y NO finge que cerró', fakeAsync(() => {
    let suscripciones = 0;
    authService.logout.and.returnValue(new Observable<ApiResponse<void>>(subscriber => {
      suscripciones++;
      subscriber.error({ status: 0 });
    }));

    service.logout();
    tick(500);

    expect(suscripciones).toBe(2);
    expect(authStore.logout).not.toHaveBeenCalled();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(service.logoutError()).toContain('No se pudo cerrar la sesión');
  }));

  it('un reintento exitoso completa el cierre', fakeAsync(() => {
    let suscripciones = 0;
    authService.logout.and.returnValue(new Observable<ApiResponse<void>>(subscriber => {
      suscripciones++;
      if (suscripciones === 1) {
        subscriber.error({ status: 503 });
      } else {
        subscriber.next(ok);
        subscriber.complete();
      }
    }));

    service.logout();
    tick(500);

    expect(authStore.logout).toHaveBeenCalled();
    expect(service.logoutError()).toBeNull();
  }));

  it('ignora un segundo clic mientras el cierre está en curso', () => {
    authService.logout.and.returnValue(new Subject<ApiResponse<void>>());

    service.logout();
    service.logout();

    expect(authService.logout).toHaveBeenCalledTimes(1);
  });

  it('las demás pestañas cierran su sesión cuando una pestaña avisa el cierre', async () => {
    authStore.setAuth({ ...({} as any), roles: ['ROLE_ADMIN'], menu: [] } as any);
    service.listenForCrossTabEvents();
    const otraPestana = new BroadcastChannel('softvet-auth');

    otraPestana.postMessage({ type: 'logout' });
    await new Promise(resolve => setTimeout(resolve, 100));
    otraPestana.close();

    expect(authStore.logout).toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login', { replaceUrl: true });
  });
});
