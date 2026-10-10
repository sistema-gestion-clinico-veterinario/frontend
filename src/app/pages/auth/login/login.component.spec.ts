import { ComponentFixture, fakeAsync, flushMicrotasks, TestBed } from '@angular/core/testing';
import { LoginComponent } from './login.component';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Subject, of, throwError } from 'rxjs';
import { LoadingStore } from '../../../store/loading.store';

const activatedRouteStub = { snapshot: { paramMap: convertToParamMap({}) } };

describe('LoginComponent – greeting', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LoginComponent, HttpClientTestingModule],
      providers: [
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigateByUrl']) },
        { provide: ActivatedRoute, useValue: activatedRouteStub },
        { provide: AuthService, useValue: jasmine.createSpyObj('AuthService', ['login', 'adminLogin', 'refreshToken']) },
      ],
    })
      .overrideComponent(LoginComponent, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    (TestBed.inject(Router) as jasmine.SpyObj<Router>).navigateByUrl.and.resolveTo(true);
    jasmine.clock().install();
  });

  afterEach(() => {
    document.getElementById('username')?.remove();
    document.getElementById('password')?.remove();
    jasmine.clock().uninstall();
  });

  it('returns "Buenos días" before noon (hour < 12)', () => {
    jasmine.clock().mockDate(new Date(2025, 6, 5, 9, 0, 0));
    expect(component.greeting).toBe('Buenos días');
  });

  it('returns "Buenas tardes" between noon and 19:00 (12 ≤ hour < 19)', () => {
    jasmine.clock().mockDate(new Date(2025, 6, 5, 15, 30, 0));
    expect(component.greeting).toBe('Buenas tardes');
  });

  it('returns "Buenas noches" at 19:00 or later (hour ≥ 19)', () => {
    jasmine.clock().mockDate(new Date(2025, 6, 5, 21, 0, 0));
    expect(component.greeting).toBe('Buenas noches');
  });
});

describe('LoginComponent - submit validations', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LoginComponent, HttpClientTestingModule],
      providers: [
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigateByUrl']) },
        { provide: ActivatedRoute, useValue: activatedRouteStub },
        { provide: AuthService, useValue: jasmine.createSpyObj('AuthService', ['login', 'adminLogin', 'refreshToken']) },
      ],
    })
      .overrideComponent(LoginComponent, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    // La empresa la resuelve el slug de la URL - en produccion lo asigna
    // ngOnInit al leer el parametro de ruta; aqui se fija directo porque
    // estas pruebas no ejecutan el ciclo de vida completo del componente.
    component.slug = 'duquedecan';
    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    (TestBed.inject(Router) as jasmine.SpyObj<Router>).navigateByUrl.and.resolveTo(true);
  });

  afterEach(() => {
    document.getElementById('username')?.remove();
    document.getElementById('password')?.remove();
  });

  it('bloquea usuario con espacios y no llama al servicio de login', () => {
    createLoginInput('username', ' admin.test ');
    createLoginInput('password', 'secret123');

    component.submit();

    expect(component.authError).toBe('El usuario no debe contener espacios al inicio o al final.');
    expect(authService.login).not.toHaveBeenCalled();
  });

  it('bloquea password con espacios al inicio o al final y no llama al servicio de login', () => {
    createLoginInput('username', 'admin.test');
    createLoginInput('password', ' secret123 ');

    component.submit();

    expect(component.authError).toBe('La contraseña no debe iniciar ni terminar con espacios.');
    expect(authService.login).not.toHaveBeenCalled();
  });

  it('rechaza respuesta exitosa sin roles asignados', () => {
    createLoginInput('username', 'admin.test');
    createLoginInput('password', 'secret123');
    authService.login.and.returnValue(of({
      data: {
        roles: [],
        assignedRoles: [],
        companyId: 1,
        companyName: 'VargasVet',
        nombreCompleto: 'Admin Test',
        userType: 'EMPLEADO',
        empleadoId: 1,
        passwordChanged: true,
        needsCompanySelection: false,
        menu: [],
      }
    } as any));

    component.submit();

    expect(component.authError).toBe('Tu usuario no tiene ningún rol asignado. Contacta al administrador.');
  });

  const cuentaCerrada409 = () => throwError(() => ({
    status: 409,
    error: { success: false, message: 'Tu cuenta está cerrada', data: { code: 'CUENTA_CERRADA', reactivableHasta: '2026-11-05T13:38:45' } }
  }));

  const sesionDeCliente = () => of({
    data: { roles: ['ROLE_APODERADO'], assignedRoles: ['ROLE_APODERADO'], companyId: 1, menu: [] }
  } as any);

  it('con la contraseña correcta de una cuenta cerrada ofrece reactivarla en vez de mostrar un error', () => {
    createLoginInput('username', 'ana');
    createLoginInput('password', 'secret123');
    authService.login.and.returnValue(cuentaCerrada409());

    component.submit();

    expect(component.showReactivar).toBeTrue();
    expect(component.authError).toBeNull();
    expect(component.fechaLimiteDeReactivacion).toBe('05/11/2026');
  });

  it('al aceptar, repite el inicio de sesión pidiendo reactivar y entra', () => {
    const router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    createLoginInput('username', 'ana');
    createLoginInput('password', 'secret123');
    authService.login.and.returnValues(cuentaCerrada409(), sesionDeCliente());
    component.submit();

    component.reactivar();

    expect(authService.login.calls.mostRecent().args[0]).toEqual(
      { slug: 'duquedecan', username: 'ana', password: 'secret123', reactivarCuenta: true });
    expect(router.navigateByUrl).toHaveBeenCalled();
    expect(component.showReactivar).toBeFalse();
    expect(component.authError).toBeNull();
  });

  it('el primer intento nunca reactiva por su cuenta', () => {
    createLoginInput('username', 'ana');
    createLoginInput('password', 'secret123');
    authService.login.and.returnValue(cuentaCerrada409());

    component.submit();

    expect(authService.login).toHaveBeenCalledTimes(1);
    expect(authService.login.calls.mostRecent().args[0].reactivarCuenta).toBeUndefined();
  });

  it('Ahora no cierra el diálogo, borra la contraseña y no reactiva', () => {
    createLoginInput('username', 'ana');
    createLoginInput('password', 'secret123');
    authService.login.and.returnValue(cuentaCerrada409());
    component.submit();

    component.cerrarReactivar();

    expect(component.showReactivar).toBeFalse();
    expect((document.getElementById('password') as HTMLInputElement).value).toBe('');
    expect(authService.login).toHaveBeenCalledTimes(1);
  });

  it('si la clínica gestiona el acceso, muestra su mensaje y cierra el diálogo', () => {
    createLoginInput('username', 'ana');
    createLoginInput('password', 'secret123');
    authService.login.and.returnValues(cuentaCerrada409(), throwError(() => ({
      status: 403, error: { message: 'Tu acceso a esta clínica lo gestiona el administrador. Contáctalo para volver.' }
    })));
    component.submit();

    component.reactivar();

    expect(component.showReactivar).toBeFalse();
    expect(component.reactivando).toBeFalse();
    expect(component.authError).toContain('lo gestiona el administrador');
  });

  it('una contraseña incorrecta sigue dando el error genérico, sin revelar nada', () => {
    createLoginInput('username', 'ana');
    createLoginInput('password', 'mala');
    authService.login.and.returnValue(throwError(() => ({ status: 401, error: { message: 'Credenciales inválidas' } })));

    component.submit();

    expect(component.showReactivar).toBeFalse();
    expect(component.authError).toBe('Credenciales inválidas');
  });

  it('[BB-001] permite iniciar sesion con credenciales validas y redirige al usuario', () => {
    const router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    createLoginInput('username', 'admin.test');
    createLoginInput('password', 'secret123');
    authService.login.and.returnValue(of({
      data: {
        roles: ['ROLE_ADMIN'],
        assignedRoles: ['ROLE_ADMIN'],
        companyId: 1,
        companyName: 'VargasVet',
        nombreCompleto: 'Admin Test',
        userType: 'EMPLEADO',
        empleadoId: 1,
        passwordChanged: true,
        needsCompanySelection: false,
        menu: [],
      }
    } as any));

    component.submit();

    expect(component.authError).toBeNull();
    expect(authService.login).toHaveBeenCalledWith({ slug: 'duquedecan', username: 'admin.test', password: 'secret123' });
    expect(router.navigateByUrl).toHaveBeenCalled();
  });

  it('entra al flujo protegido para mostrar primero el aviso de la clínica aunque haya documentos de SoftVet vencidos', () => {
    const router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    createLoginInput('username', 'admin.test');
    createLoginInput('password', 'secret123');
    authService.login.and.returnValue(of({
      data: {
        roles: ['ROLE_ADMIN'],
        assignedRoles: ['ROLE_ADMIN'],
        companyId: 1,
        companyName: 'VargasVet',
        nombreCompleto: 'Admin Test',
        userType: 'EMPLEADO',
        empleadoId: 1,
        passwordChanged: true,
        needsCompanySelection: false,
        needsLegalAcceptance: true,
        legalAcceptanceOverdue: true,
        menu: [],
      }
    } as any));

    component.submit();

    expect(router.navigateByUrl).toHaveBeenCalled();
    expect(router.navigateByUrl).not.toHaveBeenCalledWith('/legal/accept');
  });

  it('no redirige a /legal/accept si solo hay un pendiente dentro del periodo de gracia (aviso no intrusivo)', () => {
    const router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    createLoginInput('username', 'admin.test');
    createLoginInput('password', 'secret123');
    authService.login.and.returnValue(of({
      data: {
        roles: ['ROLE_ADMIN'],
        assignedRoles: ['ROLE_ADMIN'],
        companyId: 1,
        companyName: 'VargasVet',
        nombreCompleto: 'Admin Test',
        userType: 'EMPLEADO',
        empleadoId: 1,
        passwordChanged: true,
        needsCompanySelection: false,
        needsLegalAcceptance: true,
        legalAcceptanceOverdue: false,
        menu: [],
      }
    } as any));

    component.submit();

    expect(router.navigateByUrl).not.toHaveBeenCalledWith('/legal/accept');
  });

  it('mantiene bloqueada la interfaz hasta que finaliza la navegacion', fakeAsync(() => {
    const router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    const loadingStore = TestBed.inject(LoadingStore);
    let completeNavigation!: (value: boolean) => void;
    router.navigateByUrl.and.returnValue(new Promise<boolean>((resolve) => {
      completeNavigation = resolve;
    }));
    createLoginInput('username', 'admin.test');
    createLoginInput('password', 'secret123');
    authService.login.and.returnValue(of({
      data: {
        roles: ['ROLE_ADMIN'],
        assignedRoles: ['ROLE_ADMIN'],
        companyId: 1,
        companyName: 'VargasVet',
        nombreCompleto: 'Admin Test',
        userType: 'EMPLEADO',
        empleadoId: 1,
        passwordChanged: true,
        needsCompanySelection: false,
        menu: [],
      }
    } as any));

    component.submit();

    expect(component.isSubmitting).toBeTrue();
    expect(loadingStore.isLoading()).toBeTrue();

    completeNavigation(true);
    flushMicrotasks();

    expect(component.isSubmitting).toBeFalse();
    expect(loadingStore.isLoading()).toBeFalse();
  }));

  it('[BB-002] rechaza credenciales invalidas y muestra el mensaje del servidor', () => {
    createLoginInput('username', 'admin.test');
    createLoginInput('password', 'incorrecta');
    authService.login.and.returnValue(throwError(() => ({
      status: 401,
      error: { message: 'Usuario o contrasena incorrectos.' },
    })));

    component.submit();

    expect(component.authError).toBe('Usuario o contrasena incorrectos.');
  });

  it('no llama a AuthService.login cuando no hay slug ni es la ruta de SuperAdmin (aislamiento total entre empresas)', () => {
    component.slug = null;
    component.isAdminRoute = false;
    createLoginInput('username', 'admin.test');
    createLoginInput('password', 'secret123');

    component.submit();

    expect(authService.login).not.toHaveBeenCalled();
  });

  it('usa adminLogin sin slug cuando la ruta es la reservada de SuperAdmin', () => {
    component.slug = null;
    component.isAdminRoute = true;
    createLoginInput('username', 'superadmin');
    createLoginInput('password', 'secret123');
    authService.adminLogin.and.returnValue(of({
      data: {
        roles: ['ROLE_SUPER_ADMIN'],
        assignedRoles: ['ROLE_SUPER_ADMIN'],
        companyId: null,
        nombreCompleto: 'Super Admin',
        userType: 'SUPER_ADMIN',
        passwordChanged: true,
        needsCompanySelection: false,
        menu: [],
      }
    } as any));

    component.submit();

    expect(authService.adminLogin).toHaveBeenCalledWith({ username: 'superadmin', password: 'secret123' });
    expect(authService.login).not.toHaveBeenCalled();
  });
});

function createLoginInput(id: string, value: string) {
  const input = document.createElement('input');
  input.id = id;
  input.value = value;
  document.body.appendChild(input);
}

describe('LoginComponent - continuar con Google', () => {
  let component: LoginComponent;
  let authService: jasmine.SpyObj<AuthService>;
  let redirect: jasmine.Spy;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent, HttpClientTestingModule],
      providers: [
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigateByUrl']) },
        { provide: ActivatedRoute, useValue: activatedRouteStub },
        { provide: AuthService, useValue: jasmine.createSpyObj('AuthService', ['createGoogleIntent', 'googleStartUrl', 'reactivateWithGoogle']) },
      ],
    })
      .overrideComponent(LoginComponent, { set: { template: '' } })
      .compileComponents();

    component = TestBed.createComponent(LoginComponent).componentInstance;
    component.slug = 'vargas-vet';
    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    authService.googleStartUrl.and.callFake((intent: string) => `https://api.test/auth/google/start?intent=${intent}`);
    redirect = spyOn(component, 'redirectTo');
    (TestBed.inject(Router) as jasmine.SpyObj<Router>).navigateByUrl.and.resolveTo(true);
  });

  it('usa el acceso preparado y sale a Google con el código opaco', () => {
    authService.createGoogleIntent.and.returnValue(of({ success: true, message: 'ok', data: { intent: 'abc123' } }));

    component.continueWithGoogle();

    expect(authService.createGoogleIntent).toHaveBeenCalledWith({ slug: 'vargas-vet' });
    expect(redirect).toHaveBeenCalledWith('https://api.test/auth/google/start?intent=abc123');
  });

  it('ignora un segundo clic mientras el navegador sale hacia Google', () => {
    authService.createGoogleIntent.and.returnValue(new Subject<any>());

    component.continueWithGoogle();
    component.continueWithGoogle();

    expect(authService.createGoogleIntent).toHaveBeenCalledTimes(1);
    expect(redirect).not.toHaveBeenCalled();
  });

  it('si no pudo preparar el acceso, muestra un mensaje y permite volver a intentar', () => {
    authService.createGoogleIntent.and.returnValue(throwError(() => ({ status: 500 })));

    component.continueWithGoogle();

    expect(component.authError).toBe('No se pudo iniciar sesión con Google. Intenta nuevamente.');
    expect(component.startingGoogle).toBeFalse();
  });

  it('explica con claridad cada motivo por el que Google no deja entrar', () => {
    const mensajes = (LoginComponent as any).GOOGLE_ERROR_MESSAGES as Record<string, string>;

    expect(mensajes['google_cuenta_suspendida']).toContain('suspendido');
    const avisos = (LoginComponent as any).NOTICES as Record<string, string>;
    expect(avisos['sesion_otra_clinica']).toContain('no corresponde a esta clínica');
    expect(avisos['sesion_otra_clinica']).toContain('no se cierran');
    expect(avisos['google_cuenta_cerrada']).toBeUndefined();
    expect(mensajes['google_cuenta_cerrada']).toContain('ya no se puede reactivar');
    expect(mensajes['google_cuenta_dada_de_baja']).toContain('ya no está activo');
    expect(mensajes['google_cuenta_no_habilitada']).toContain('no puede ingresar por ahora');
    expect(mensajes['google_sin_acceso_clinica']).toContain('no está registrada');
  });

  it('con Google, una cuenta cerrada con su confirmación abre el diálogo de reactivar y no muestra error', () => {
    component.aplicarMensajesDeLaUrl(null, 'google_cuenta_cerrada', 'ticket-1');

    expect(component.showReactivar).toBeTrue();
    expect(component.authError).toBeNull();
    expect(component.showNotice).toBeFalse();
  });

  it('con Google, una cuenta cerrada sin confirmación (o vencida) explica que ya no se puede reactivar desde aquí', () => {
    component.aplicarMensajesDeLaUrl(null, 'google_cuenta_cerrada');

    expect(component.showReactivar).toBeFalse();
    expect(component.authError).toContain('ya no se puede reactivar');
  });

  it('reactivar con Google canjea la confirmación y entra', () => {
    const router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    authService.reactivateWithGoogle.and.returnValue(of({
      data: { roles: ['ROLE_APODERADO'], assignedRoles: ['ROLE_APODERADO'], companyId: 1, menu: [] }
    } as any));
    component.aplicarMensajesDeLaUrl(null, 'google_cuenta_cerrada', 'ticket-1');

    component.reactivar();

    expect(authService.reactivateWithGoogle).toHaveBeenCalledWith('ticket-1');
    expect(router.navigateByUrl).toHaveBeenCalled();
    expect(component.showReactivar).toBeFalse();
  });

  it('Ahora no cierra el diálogo y olvida la confirmación', () => {
    component.aplicarMensajesDeLaUrl(null, 'google_cuenta_cerrada', 'ticket-1');

    component.cerrarReactivar();
    component.reactivar();

    expect(component.showReactivar).toBeFalse();
    expect(authService.reactivateWithGoogle).not.toHaveBeenCalledWith('ticket-1');
  });

  it('si Google ya no acepta la confirmación, avisa y cierra el diálogo', () => {
    authService.reactivateWithGoogle.and.returnValue(throwError(() => ({
      status: 401, error: { message: 'La confirmación de Google expiró. Vuelve a continuar con Google.' }
    })));
    component.aplicarMensajesDeLaUrl(null, 'google_cuenta_cerrada', 'ticket-1');

    component.reactivar();

    expect(component.showReactivar).toBeFalse();
    expect(component.reactivando).toBeFalse();
    expect(component.authError).toContain('expiró');
  });

  it('un error de verdad no abre el diálogo de avisos', () => {
    component.aplicarMensajesDeLaUrl(null, 'google_cuenta_suspendida');

    expect(component.showNotice).toBeFalse();
    expect(component.noticeTitle).toBe('');
  });

  it('sin aviso ni error no hay diálogo', () => {
    component.aplicarMensajesDeLaUrl(null, null);

    expect(component.showNotice).toBeFalse();
    expect(component.authNotice).toBe('');
  });

  it('los demás motivos de Google siguen siendo errores', () => {
    component.aplicarMensajesDeLaUrl(null, 'google_cuenta_suspendida');

    expect(component.authError).toContain('suspendido');
    expect(component.authNotice).toBe('');
  });

  it('un código desconocido da el error genérico y un aviso de la dirección se muestra como aviso', () => {
    component.aplicarMensajesDeLaUrl(null, 'codigo_raro');
    expect(component.authError).toBe('No se pudo iniciar sesión con Google. Intenta nuevamente.');

    component.aplicarMensajesDeLaUrl('sesion_otra_clinica', null);
    expect(component.authNotice).toContain('no corresponde a esta clínica');
  });
});
