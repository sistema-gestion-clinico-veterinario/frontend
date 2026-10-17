import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { GoogleCallbackComponent } from './google-callback.component';
import { AuthService, GOOGLE_PENDING_SLUG_KEY } from '../../../core/services/auth.service';
import { SessionService } from '../../../core/services/session.service';

describe('GoogleCallbackComponent', () => {
  let fixture: ComponentFixture<GoogleCallbackComponent>;
  let component: GoogleCallbackComponent;
  let auth: jasmine.SpyObj<AuthService>;
  let sesion: jasmine.SpyObj<SessionService>;
  let router: jasmine.SpyObj<Router>;
  let volverAlLogin: jasmine.Spy;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sesionDe = (roles: string[]): any => ({ data: { roles, menu: [], activeRolePurpose: 'COMPANY_ADMIN' } });

  function crear(code: string | null): void {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['exchangeGoogleCode']);
    sesion = jasmine.createSpyObj<SessionService>('SessionService', ['establish']);
    router = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
    router.navigateByUrl.and.resolveTo(true);

    TestBed.configureTestingModule({
      imports: [GoogleCallbackComponent],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: SessionService, useValue: sesion },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(code ? { code } : {}) } } }
      ]
    });
    fixture = TestBed.createComponent(GoogleCallbackComponent);
    component = fixture.componentInstance;
    volverAlLogin = spyOn(component as never, 'returnToLogin' as never);
  }

  afterEach(() => sessionStorage.removeItem(GOOGLE_PENDING_SLUG_KEY));

  it('muestra el logotipo mientras inicia la sesión y lo anuncia como estado', () => {
    crear('abc');
    auth.exchangeGoogleCode.and.returnValue(of(sesionDe(['ROLE_ADMIN'])));
    fixture.detectChanges();

    const contenedor = fixture.nativeElement.querySelector('[role="status"]') as HTMLElement;
    expect(contenedor.getAttribute('aria-label')).toBe('Iniciando sesión');
    expect(contenedor.querySelector('img')?.getAttribute('alt')).toBe('SoftVet');
  });

  it('sin código de Google vuelve al login sin llamar al servidor', () => {
    crear(null);
    fixture.detectChanges();

    expect(auth.exchangeGoogleCode).not.toHaveBeenCalled();
    expect(volverAlLogin).toHaveBeenCalled();
  });

  it('si el servidor rechaza el código, vuelve al login', () => {
    crear('abc');
    auth.exchangeGoogleCode.and.returnValue(throwError(() => ({ status: 400 })));
    fixture.detectChanges();

    expect(volverAlLogin).toHaveBeenCalled();
    expect(sesion.establish).not.toHaveBeenCalled();
  });

  it('si la cuenta no tiene roles, vuelve al login sin abrir sesión', () => {
    crear('abc');
    auth.exchangeGoogleCode.and.returnValue(of(sesionDe([])));
    fixture.detectChanges();

    expect(volverAlLogin).toHaveBeenCalled();
    expect(sesion.establish).not.toHaveBeenCalled();
  });

  it('con roles abre la sesión, olvida la clínica pendiente y navega a la ruta inicial', () => {
    sessionStorage.setItem(GOOGLE_PENDING_SLUG_KEY, 'clinica-patitas');
    crear('abc');
    auth.exchangeGoogleCode.and.returnValue(of(sesionDe(['ROLE_ADMIN'])));
    fixture.detectChanges();

    expect(auth.exchangeGoogleCode).toHaveBeenCalledWith('abc');
    expect(sesion.establish).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(GOOGLE_PENDING_SLUG_KEY)).toBeNull();
    expect(router.navigateByUrl).toHaveBeenCalledTimes(1);
    expect(volverAlLogin).not.toHaveBeenCalled();
  });

  it('si la ruta inicial no existe, entra por el panel principal', async () => {
    crear('abc');
    router.navigateByUrl.and.returnValues(Promise.resolve(false), Promise.resolve(true));
    auth.exchangeGoogleCode.and.returnValue(of(sesionDe(['ROLE_ADMIN'])));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(router.navigateByUrl).toHaveBeenCalledTimes(2);
  });
});
