import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ConfirmEmailChangeComponent } from './confirm-email-change.component';

describe('ConfirmEmailChangeComponent', () => {
  function create(fragment: string) {
    TestBed.configureTestingModule({
      imports: [ConfirmEmailChangeComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { fragment, queryParamMap: { get: () => null } } }
        }
      ]
    });
    const fixture = TestBed.createComponent(ConfirmEmailChangeComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, http: TestBed.inject(HttpTestingController) };
  }

  it('cancela la solicitud con el enlace "no fui yo" y explica que el correo no cambió', () => {
    const { component, http } = create('type=cancelar&token=abc');

    const req = http.expectOne(r => r.url.endsWith('/auth/email-change/cancel'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ token: 'abc' });
    req.flush({ success: true, message: 'ok', data: null });

    expect(component.completed()).toBeTrue();
    expect(component.error()).toBeFalse();
    expect(component.message()).toContain('tu correo de acceso no cambió');
    http.verify();
  });

  it('muestra el error cuando el enlace de cancelación ya no es válido', () => {
    const { component, http } = create('type=cancelar&token=viejo');

    http.expectOne(r => r.url.endsWith('/auth/email-change/cancel'))
      .flush({ success: false, message: 'El enlace es inválido o ya fue utilizado', data: null }, { status: 400, statusText: 'Bad Request' });

    expect(component.error()).toBeTrue();
    expect(component.message()).toContain('inválido o ya fue utilizado');
  });

  it('sigue confirmando el correo actual y el nuevo como antes', () => {
    const { http } = create('type=actual&token=abc');

    const req = http.expectOne(r => r.url.endsWith('/auth/email-change/confirm-current'));
    expect(req.request.body).toEqual({ token: 'abc' });
    req.flush({ success: true, message: 'ok', data: false });
    http.verify();
  });

  it('rechaza un tipo de enlace desconocido sin llamar al servidor', () => {
    const { component, http } = create('type=otro&token=abc');

    expect(component.error()).toBeTrue();
    http.expectNone(() => true);
  });
});
