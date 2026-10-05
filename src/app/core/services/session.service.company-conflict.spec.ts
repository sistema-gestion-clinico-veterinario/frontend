import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { AuthStore } from '../../store/auth.store';
import { NavigationService } from './navigation.service';

const sesion = (slug: string, companyId: number): any => ({
  success: true,
  message: 'ok',
  data: {
    roles: ['ROLE_ADMIN'], assignedRoles: ['ROLE_ADMIN'], companyId, companyName: slug, companySlug: slug,
    nombreCompleto: 'Ana Pérez', userType: 'EMPLEADO', empleadoId: 1, passwordChanged: true,
    needsCompanySelection: false, menu: [], activeRolePurpose: 'COMPANY_ADMIN'
  }
});

describe('SessionService - una sola clínica por navegador', () => {
  let service: SessionService;
  let authService: jasmine.SpyObj<AuthService>;
  let authStore: InstanceType<typeof AuthStore>;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['refreshToken']);
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
  });

  it('si la dirección es de una clínica y la cookie trae la sesión de otra, no adopta esa sesión y avisa del conflicto', (done) => {
    authService.refreshToken.and.returnValue(of(sesion('clinica-a', 1)));

    service.initialize('clinica-b').subscribe((autenticado) => {
      expect(autenticado).toBeFalse();
      expect(authStore.sessionStatus()).not.toBe('authenticated');
      expect(authStore.companySlug()).toBeNull();
      expect(service.sessionConflict()).toBeTrue();
      done();
    });
  });

  it('si la dirección y la sesión son de la misma clínica la adopta sin conflicto', (done) => {
    authService.refreshToken.and.returnValue(of(sesion('clinica-a', 1)));

    service.initialize('clinica-a').subscribe((autenticado) => {
      expect(autenticado).toBeTrue();
      expect(authStore.companySlug()).toBe('clinica-a');
      expect(service.sessionConflict()).toBeFalse();
      done();
    });
  });

  it('el acceso de plataforma no adopta la sesión de una clínica aunque sea la única abierta', (done) => {
    authService.refreshToken.and.returnValue(of(sesion('clinica-a', 1)));

    service.initialize(null, true).subscribe((autenticado) => {
      expect(autenticado).toBeFalse();
      expect(authStore.sessionStatus()).not.toBe('authenticated');
      expect(authStore.companySlug()).toBeNull();
      expect(service.sessionConflict()).toBeFalse();
      done();
    });
  });

  it('el acceso de plataforma sí adopta una sesión de plataforma', (done) => {
    const plataforma: any = sesion('x', 0);
    plataforma.data.companySlug = null;
    plataforma.data.companyId = null;
    plataforma.data.activeRolePurpose = 'PLATFORM_ADMIN';
    authService.refreshToken.and.returnValue(of(plataforma));

    service.initialize(null, true).subscribe((autenticado) => {
      expect(autenticado).toBeTrue();
      expect(authStore.companySlug()).toBeNull();
      done();
    });
  });

  it('el acceso de plataforma no sigue adelante si la pestaña ya está autenticada en una clínica', (done) => {
    service.establish(sesion('clinica-a', 1).data);

    service.initialize(null, true).subscribe((autenticado) => {
      expect(autenticado).toBeFalse();
      expect(service.sessionConflict()).toBeFalse();
      done();
    });
  });

  it('una pestaña ya autenticada en otra clínica tampoco sigue adelante con una dirección distinta', (done) => {
    service.establish(sesion('clinica-a', 1).data);

    service.initialize('clinica-b').subscribe((autenticado) => {
      expect(autenticado).toBeFalse();
      expect(service.sessionConflict()).toBeTrue();
      done();
    });
  });

  it('el cierre de sesión de otra clínica en otra pestaña no cierra la sesión de esta', async () => {
    service.establish(sesion('clinica-a', 1).data);
    spyOn(authStore, 'logout').and.callThrough();
    service.listenForCrossTabEvents();
    const otraPestana = new BroadcastChannel('softvet-auth');

    otraPestana.postMessage({ type: 'logout', slug: 'clinica-b' });
    await new Promise(resolve => setTimeout(resolve, 100));
    otraPestana.close();

    expect(authStore.logout).not.toHaveBeenCalled();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('el cierre de sesión de la misma clínica en otra pestaña sí cierra la de esta', async () => {
    service.establish(sesion('clinica-a', 1).data);
    spyOn(authStore, 'logout').and.callThrough();
    service.listenForCrossTabEvents();
    const otraPestana = new BroadcastChannel('softvet-auth');

    otraPestana.postMessage({ type: 'logout', slug: 'clinica-a' });
    await new Promise(resolve => setTimeout(resolve, 100));
    otraPestana.close();

    expect(authStore.logout).toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login', { replaceUrl: true });
  });

  it('iniciar sesión en otra clínica ya no expulsa a las demás pestañas: cada clínica tiene su propia sesión', async () => {
    const escucha = new BroadcastChannel('softvet-auth');
    const recibidos: any[] = [];
    escucha.onmessage = (evento) => recibidos.push(evento.data);

    service.establish(sesion('clinica-b', 2).data);
    await new Promise(resolve => setTimeout(resolve, 100));
    escucha.close();

    expect(recibidos.filter(m => m.type === 'session-started')).toEqual([]);
  });

  it('al cerrar la propia sesión avisa a las demás pestañas con la clínica que cerró', async () => {
    service.establish(sesion('clinica-a', 1).data);
    const escucha = new BroadcastChannel('softvet-auth');
    const recibidos: any[] = [];
    escucha.onmessage = (evento) => recibidos.push(evento.data);

    service.closeLocalSession();
    await new Promise(resolve => setTimeout(resolve, 100));
    escucha.close();

    expect(recibidos).toContain(jasmine.objectContaining({ type: 'logout', slug: 'clinica-a' }));
  });
});
