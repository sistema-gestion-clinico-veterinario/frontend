import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VerifyEmailComponent } from './verify-email.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';

describe('VerifyEmailComponent', () => {
  let component: VerifyEmailComponent;
  let fixture: ComponentFixture<VerifyEmailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VerifyEmailComponent, HttpClientTestingModule],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => null } }, params: of({}), queryParams: of({}) } },
      ],
    })
    .overrideComponent(VerifyEmailComponent, { set: { template: '' } })
    .compileComponents();

    fixture = TestBed.createComponent(VerifyEmailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('activar con Google', () => {
    let redirect: jasmine.Spy;
    let authService: AuthService;

    beforeEach(() => {
      authService = TestBed.inject(AuthService);
      redirect = spyOn(component, 'redirectTo');
      component.token = 'token-de-invitacion';
    });

    it('deja el enlace de invitación en el servidor y sale a Google sin llevarlo en la URL', () => {
      const intent = spyOn(authService, 'createGoogleIntent').and.returnValue(of({ success: true, message: 'ok', data: { intent: 'abc123' } }));

      component.continueWithGoogle();

      expect(intent).toHaveBeenCalledWith({ activationToken: 'token-de-invitacion' });
      const destino = redirect.calls.mostRecent().args[0] as string;
      expect(destino).toContain('/auth/google/start?intent=abc123');
      expect(destino).not.toContain('token-de-invitacion');
    });

    it('sin enlace de invitación no hace nada', () => {
      const intent = spyOn(authService, 'createGoogleIntent');
      component.token = '';

      component.continueWithGoogle();

      expect(intent).not.toHaveBeenCalled();
      expect(redirect).not.toHaveBeenCalled();
    });

    it('si el servidor no responde, avisa y ofrece crear la contraseña', () => {
      spyOn(authService, 'createGoogleIntent').and.returnValue(throwError(() => ({ status: 500 })));

      component.continueWithGoogle();

      expect(component.googleError()).toContain('cree su contraseña');
      expect(redirect).not.toHaveBeenCalled();
      expect(component.startingGoogle).toBeFalse();
    });
  });
});
