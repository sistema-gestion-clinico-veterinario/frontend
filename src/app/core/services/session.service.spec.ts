import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { AuthStore } from '../../store/auth.store';

describe('SessionService', () => {
  let service: SessionService;
  let authService: jasmine.SpyObj<AuthService>;
  let authStore: InstanceType<typeof AuthStore>;

  beforeEach(() => {
    localStorage.clear();
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['refreshToken']);
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: authService }],
    });
    service = TestBed.inject(SessionService);
    authStore = TestBed.inject(AuthStore);
  });

  it('autentica solo despues de validar la cookie de sesion con el backend', (done) => {
    authService.refreshToken.and.returnValue(of(authResponse(['ROLE_ADMIN'])));

    service.initialize().subscribe((authenticated) => {
      expect(authenticated).toBeTrue();
      expect(authStore.sessionStatus()).toBe('authenticated');
      expect(authStore.roles()).toEqual(['ROLE_ADMIN']);
      expect(authService.refreshToken).toHaveBeenCalledTimes(1);
      done();
    });
  });

  it('elimina el estado local cuando el backend rechaza la sesion', (done) => {
    localStorage.setItem('auth', JSON.stringify({
      roles: ['ROLE_SUPER_ADMIN'],
      menu: [{ codigo: 'VISTA_ROLES', leer: true }],
    }));
    authService.refreshToken.and.returnValue(throwError(() => ({ status: 401 })));

    service.initialize().subscribe((authenticated) => {
      expect(authenticated).toBeFalse();
      expect(authStore.sessionStatus()).toBe('anonymous');
      expect(authStore.roles()).toEqual([]);
      expect(authStore.menu()).toEqual([]);
      expect(localStorage.getItem('auth')).toBeNull();
      done();
    });
  });

  it('no repite la validacion cuando la sesion ya esta autenticada', (done) => {
    service.establish(authResponse(['ROLE_ADMIN']).data);

    service.initialize().subscribe((authenticated) => {
      expect(authenticated).toBeTrue();
      expect(authService.refreshToken).not.toHaveBeenCalled();
      done();
    });
  });
});

function authResponse(roles: string[]): any {
  return {
    success: true,
    message: 'ok',
    data: {
      roles,
      assignedRoles: roles,
      companyId: 1,
      companyName: 'VargasVet',
      nombreCompleto: 'Usuario Prueba',
      userType: 'EMPLEADO',
      empleadoId: 1,
      passwordChanged: true,
      needsCompanySelection: false,
      menu: [],
    },
  };
}
