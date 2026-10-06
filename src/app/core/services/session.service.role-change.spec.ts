import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthLoginData } from '../../models/response/auth-login-response.model';
import { ApiResponse } from '../../models/response/api-response';
import { AuthStore } from '../../store/auth.store';
import { AuthService } from './auth.service';
import { NavigationService } from './navigation.service';
import { SessionService } from './session.service';

const roleData = {
  roles: ['ROLE_VETERINARIO'],
  activeRoleId: 2,
  activeRolePurpose: 'CUSTOM',
  menu: [{ ruta: '/empleado/citas', activo: true, leer: true }],
} as unknown as AuthLoginData;

const respuesta: ApiResponse<AuthLoginData> = { success: true, message: 'ok', data: roleData };

describe('SessionService - cambio de rol', () => {
  let service: SessionService;
  let authService: jasmine.SpyObj<AuthService>;
  let authStore: InstanceType<typeof AuthStore>;
  let router: Router;
  let otraPestana: BroadcastChannel;

  beforeEach(() => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['switchRole', 'currentSession', 'refreshToken']);
    const navigationService = jasmine.createSpyObj<NavigationService>('NavigationService', ['getEffectiveNavigation']);
    navigationService.getEffectiveNavigation.and.returnValue(of({ success: true, message: 'ok', data: [] }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: NavigationService, useValue: navigationService },
      ],
    });
    service = TestBed.inject(SessionService);
    authStore = TestBed.inject(AuthStore);
    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
    spyOn(service, 'establish');
    otraPestana = new BroadcastChannel('softvet-auth');
  });

  afterEach(() => otraPestana.close());

  function esperarMensaje(): Promise<any> {
    return new Promise(resolve => { otraPestana.onmessage = (event: MessageEvent) => resolve(event.data); });
  }

  async function avisarDesdeOtraPestana(): Promise<void> {
    otraPestana.postMessage({ type: 'role-changed' });
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  it('establece la sesión del rol nuevo y va a su primera pantalla', () => {
    authService.switchRole.and.returnValue(of(respuesta as any));

    service.changeRole(2).subscribe();

    expect(authService.switchRole).toHaveBeenCalledWith(2);
    expect(service.establish).toHaveBeenCalledWith(roleData, true);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/empleado/citas', { replaceUrl: true });
  });

  it('avisa a las demás pestañas solo con una señal, sin datos de la sesión', async () => {
    authService.switchRole.and.returnValue(of(respuesta as any));
    const mensaje = esperarMensaje();

    service.changeRole(2).subscribe();

    expect(await mensaje).toEqual({ type: 'role-changed' });
  });

  it('si el servidor lo rechaza no cambia nada y propaga el error', () => {
    const rechazo = { status: 403, error: { message: 'El rol seleccionado no pertenece a tu cuenta' } };
    authService.switchRole.and.returnValue(throwError(() => rechazo));
    let recibido: unknown;

    service.changeRole(99).subscribe({ error: err => recibido = err });

    expect(recibido).toBe(rechazo);
    expect(service.establish).not.toHaveBeenCalled();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('otra pestaña con sesión pide el estado real al servidor y adopta el rol nuevo', async () => {
    authStore.setAuth({ roles: ['ROLE_ADMIN'], activeRoleId: 1, menu: [] } as any);
    authService.currentSession.and.returnValue(of(respuesta as any));
    service.listenForCrossTabEvents();

    await avisarDesdeOtraPestana();

    expect(authService.currentSession).toHaveBeenCalledTimes(1);
    expect(service.establish).toHaveBeenCalledWith(roleData, true);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/empleado/citas', { replaceUrl: true });
  });

  it('un aviso falso no cambia nada: el servidor dice que el rol sigue siendo el mismo', async () => {
    authStore.setAuth({ roles: ['ROLE_VETERINARIO'], activeRoleId: 2, menu: [] } as any);
    authService.currentSession.and.returnValue(of(respuesta as any));
    service.listenForCrossTabEvents();

    await avisarDesdeOtraPestana();

    expect(authService.currentSession).toHaveBeenCalled();
    expect(service.establish).not.toHaveBeenCalled();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('un aviso con datos inventados no se usa: solo cuenta lo que responde el servidor', async () => {
    authStore.setAuth({ roles: ['ROLE_VETERINARIO'], activeRoleId: 2, menu: [] } as any);
    authService.currentSession.and.returnValue(of(respuesta as any));
    service.listenForCrossTabEvents();

    otraPestana.postMessage({ type: 'role-changed', data: { activeRoleId: 1, roles: ['ROLE_SUPERADMIN'] } });
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(service.establish).not.toHaveBeenCalled();
  });

  it('si el servidor no confirma la sesión, la pestaña no cambia', async () => {
    authStore.setAuth({ roles: ['ROLE_ADMIN'], activeRoleId: 1, menu: [] } as any);
    authService.currentSession.and.returnValue(throwError(() => ({ status: 403 })));
    service.listenForCrossTabEvents();

    await avisarDesdeOtraPestana();

    expect(service.establish).not.toHaveBeenCalled();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('una pestaña sin sesión ignora el aviso y ni siquiera consulta al servidor', async () => {
    authStore.logout();
    service.listenForCrossTabEvents();

    await avisarDesdeOtraPestana();

    expect(authService.currentSession).not.toHaveBeenCalled();
    expect(service.establish).not.toHaveBeenCalled();
  });
});
