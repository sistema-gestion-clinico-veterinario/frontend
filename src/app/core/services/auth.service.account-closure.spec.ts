import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

describe('AuthService - cierre de cuenta', () => {
  let service: AuthService;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/auth`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('consulta si la cuenta se puede cerrar', () => {
    service.getAccountClosureEligibility().subscribe();

    const req = http.expectOne(`${base}/account/closure`);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, message: 'ok', data: { eligible: true, reason: null, requiresPassword: false } });
  });

  it('pide el código enviando la contraseña, o null si la persona no tiene una', () => {
    service.requestAccountClosure('Clave-123').subscribe();
    const conClave = http.expectOne(`${base}/account/closure/request`);
    expect(conClave.request.body).toEqual({ password: 'Clave-123' });
    conClave.flush({ success: true, message: 'ok', data: null });

    service.requestAccountClosure(null).subscribe();
    const sinClave = http.expectOne(`${base}/account/closure/request`);
    expect(sinClave.request.body).toEqual({ password: null });
    sinClave.flush({ success: true, message: 'ok', data: null });
  });

  it('confirma el cierre con el código', () => {
    service.confirmAccountClosure('482913').subscribe();

    const req = http.expectOne(`${base}/account/closure/confirm`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ code: '482913' });
    req.flush({ success: true, message: 'ok', data: null });
  });

  it('reactiva la cuenta con el enlace del correo', () => {
    service.reactivateAccount('token-del-correo').subscribe();

    const req = http.expectOne(`${base}/account/reactivate`);
    expect(req.request.body).toEqual({ token: 'token-del-correo' });
    req.flush({ success: true, message: 'ok', data: null });
  });
});
