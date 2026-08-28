import { ComponentFixture, fakeAsync, flushMicrotasks, TestBed } from '@angular/core/testing';
import { LoginComponent } from './login.component';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { LoadingStore } from '../../../store/loading.store';

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
        { provide: AuthService, useValue: jasmine.createSpyObj('AuthService', ['login', 'refreshToken']) },
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
    document.getElementById('email')?.remove();
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
        { provide: AuthService, useValue: jasmine.createSpyObj('AuthService', ['login', 'refreshToken']) },
      ],
    })
      .overrideComponent(LoginComponent, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    (TestBed.inject(Router) as jasmine.SpyObj<Router>).navigateByUrl.and.resolveTo(true);
  });

  afterEach(() => {
    document.getElementById('email')?.remove();
    document.getElementById('password')?.remove();
  });

  it('bloquea email con espacios y no llama al servicio de login', () => {
    createLoginInput('email', ' admin@test.com ');
    createLoginInput('password', 'secret123');

    component.submit();

    expect(component.authError).toBe('El correo no debe contener espacios al inicio o al final.');
    expect(authService.login).not.toHaveBeenCalled();
  });

  it('bloquea password con espacios y no llama al servicio de login', () => {
    createLoginInput('email', 'admin@test.com');
    createLoginInput('password', 'secret 123');

    component.submit();

    expect(component.authError).toBe('La contraseña no debe contener espacios.');
    expect(authService.login).not.toHaveBeenCalled();
  });

  it('bloquea password con puntos suspensivos y no llama al servicio de login', () => {
    createLoginInput('email', 'admin@test.com');
    createLoginInput('password', 'secret...');

    component.submit();

    expect(component.authError).toBe('La contraseña no debe contener "...".');
    expect(authService.login).not.toHaveBeenCalled();
  });

  it('rechaza respuesta exitosa sin roles asignados', () => {
    createLoginInput('email', 'admin@test.com');
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

  it('[BB-001] permite iniciar sesion con credenciales validas y redirige al usuario', () => {
    const router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    createLoginInput('email', 'admin@test.com');
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
    expect(authService.login).toHaveBeenCalledWith({ email: 'admin@test.com', password: 'secret123' });
    expect(router.navigateByUrl).toHaveBeenCalled();
  });

  it('mantiene bloqueada la interfaz hasta que finaliza la navegacion', fakeAsync(() => {
    const router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    const loadingStore = TestBed.inject(LoadingStore);
    let completeNavigation!: (value: boolean) => void;
    router.navigateByUrl.and.returnValue(new Promise<boolean>((resolve) => {
      completeNavigation = resolve;
    }));
    createLoginInput('email', 'admin@test.com');
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
    createLoginInput('email', 'admin@test.com');
    createLoginInput('password', 'incorrecta');
    authService.login.and.returnValue(throwError(() => ({
      status: 401,
      error: { message: 'Correo o contrasena incorrectos.' },
    })));

    component.submit();

    expect(component.authError).toBe('Correo o contrasena incorrectos.');
  });
});

function createLoginInput(id: string, value: string) {
  const input = document.createElement('input');
  input.id = id;
  input.value = value;
  document.body.appendChild(input);
}
