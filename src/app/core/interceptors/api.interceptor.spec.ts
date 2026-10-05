import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { apiInterceptor } from './api.interceptor';
import { AuthStore } from '../../store/auth.store';
import { AuthService } from '../services/auth.service';
import { CompanySlugContext } from '../services/company-slug-context.service';
import { environment } from '../../../environments/environment';

describe('apiInterceptor - clínica de la sesión', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let authStore: InstanceType<typeof AuthStore>;
  let authService: jasmine.SpyObj<AuthService>;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['refreshToken']);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authService },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    authStore = TestBed.inject(AuthStore);
    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
    authStore.setAuth({ roles: ['ROLE_ADMIN'], companyId: 7, menu: [] } as any);
  });

  afterEach(() => controller.verify());

  it('cada llamada declara en qué clínica cree estar la pantalla', () => {
    http.get(`${environment.apiUrl}/mascotas`).subscribe();

    const req = controller.expectOne(`${environment.apiUrl}/mascotas`);
    expect(req.request.headers.get('X-Company-Id')).toBe('7');
    req.flush({});
  });

  it('cada llamada lleva el slug de la clínica de la pestaña para que el servidor lea la sesión de esa clínica', () => {
    authStore.setAuth({ roles: ['ROLE_ADMIN'], companyId: 7, companySlug: 'clinica-a', menu: [] } as any);

    http.get(`${environment.apiUrl}/mascotas`).subscribe();

    const req = controller.expectOne(`${environment.apiUrl}/mascotas`);
    expect(req.request.headers.get('X-Company-Slug')).toBe('clinica-a');
    req.flush({});
  });

  it('sin sesión todavía usa el slug de la dirección, para renovar la sesión de esa clínica', () => {
    authStore.logout();
    TestBed.inject(CompanySlugContext).setSlug('clinica-b');

    http.post(`${environment.apiUrl}/auth/refresh`, {}).subscribe();

    const req = controller.expectOne(`${environment.apiUrl}/auth/refresh`);
    expect(req.request.headers.get('X-Company-Slug')).toBe('clinica-b');
    expect(req.request.headers.has('X-Company-Id')).toBeFalse();
    req.flush({});
  });

  it('la cuenta de plataforma, sin clínica ni slug, no declara ninguno', () => {
    authStore.setAuth({ roles: ['ROLE_SUPER'], companyId: null, companySlug: null, menu: [] } as any);
    TestBed.inject(CompanySlugContext).clear();

    http.get(`${environment.apiUrl}/company`).subscribe();

    const req = controller.expectOne(`${environment.apiUrl}/company`);
    expect(req.request.headers.has('X-Company-Slug')).toBeFalse();
    req.flush({});
  });

  it('las llamadas de inicio de sesión y renovación no declaran clínica', () => {
    http.post(`${environment.apiUrl}/auth/login`, {}).subscribe();

    const req = controller.expectOne(`${environment.apiUrl}/auth/login`);
    expect(req.request.headers.has('X-Company-Id')).toBeFalse();
    req.flush({});
  });

  it('la cuenta de plataforma, que no tiene clínica, no envía la cabecera', () => {
    authStore.setAuth({ roles: ['ROLE_SUPER'], companyId: null, menu: [] } as any);

    http.get(`${environment.apiUrl}/company`).subscribe();

    const req = controller.expectOne(`${environment.apiUrl}/company`);
    expect(req.request.headers.has('X-Company-Id')).toBeFalse();
    req.flush({});
  });

  it('si el servidor dice que la sesión es de otra clínica, cierra la local y vuelve al login con el aviso', () => {
    spyOn(authStore, 'logout').and.callThrough();
    let error: any;
    http.get(`${environment.apiUrl}/mascotas`).subscribe({ error: e => error = e });

    controller.expectOne(`${environment.apiUrl}/mascotas`)
      .flush({ code: 'SESSION_COMPANY_MISMATCH' }, { status: 409, statusText: 'Conflict' });

    expect(error.status).toBe(409);
    expect(authStore.logout).toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login?authNotice=sesion_otra_clinica', { replaceUrl: true });
  });

  it('un 409 de otro tipo no cierra la sesión', () => {
    spyOn(authStore, 'logout').and.callThrough();
    http.get(`${environment.apiUrl}/mascotas`).subscribe({ error: () => {} });

    controller.expectOne(`${environment.apiUrl}/mascotas`)
      .flush({ message: 'conflicto de datos' }, { status: 409, statusText: 'Conflict' });

    expect(authStore.logout).not.toHaveBeenCalled();
  });

  it('al renovar una sesión vencida, si la cookie ahora es de otra clínica no la adopta', () => {
    spyOn(authStore, 'logout').and.callThrough();
    authService.refreshToken.and.returnValue(of({ success: true, message: 'ok', data: { companyId: 9, roles: ['ROLE_ADMIN'], menu: [] } } as any));
    let error: any;
    http.get(`${environment.apiUrl}/mascotas`).subscribe({ error: e => error = e });

    controller.expectOne(`${environment.apiUrl}/mascotas`).flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(error.status).toBe(409);
    expect(authStore.logout).toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login?authNotice=sesion_otra_clinica', { replaceUrl: true });
  });

  it('al renovar una sesión de la misma clínica reintenta la llamada con normalidad', () => {
    authService.refreshToken.and.returnValue(of({ success: true, message: 'ok', data: { companyId: 7, roles: ['ROLE_ADMIN'], menu: [] } } as any));
    let respuesta: any;
    http.get(`${environment.apiUrl}/mascotas`).subscribe(r => respuesta = r);

    controller.expectOne(`${environment.apiUrl}/mascotas`).flush({}, { status: 401, statusText: 'Unauthorized' });
    controller.expectOne(`${environment.apiUrl}/mascotas`).flush({ ok: true });

    expect(respuesta).toEqual({ ok: true });
    expect(authStore.companyId()).toBe(7);
  });
});
