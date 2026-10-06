import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { CloseAccountCardComponent } from './close-account-card.component';
import { AccountClosureEligibility, AuthService } from '../../../core/services/auth.service';
import { SessionService } from '../../../core/services/session.service';
import { AuthStore } from '../../../store/auth.store';

describe('CloseAccountCardComponent', () => {
  let fixture: ComponentFixture<CloseAccountCardComponent>;
  let component: CloseAccountCardComponent;
  let authService: jasmine.SpyObj<AuthService>;
  let sessionService: jasmine.SpyObj<SessionService>;
  const purpose = signal<string | null>('CLIENT_PORTAL');
  const valorDePrueba = () => Math.random().toString(36).slice(2) + 'Aa1';

  const elegible = (parcial: Partial<AccountClosureEligibility> = {}): AccountClosureEligibility =>
    ({ eligible: true, reason: null, requiresPassword: true, ...parcial });

  async function crear(eligibilidad: AccountClosureEligibility | null = elegible()) {
    authService = jasmine.createSpyObj<AuthService>('AuthService',
      ['getAccountClosureEligibility', 'requestAccountClosure', 'confirmAccountClosure']);
    authService.getAccountClosureEligibility.and.returnValue(eligibilidad
      ? of({ success: true, message: 'ok', data: eligibilidad })
      : throwError(() => ({ status: 500 })));
    sessionService = jasmine.createSpyObj<SessionService>('SessionService', ['closeLocalSession']);
    await TestBed.configureTestingModule({
      imports: [CloseAccountCardComponent],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: SessionService, useValue: sessionService },
        { provide: AuthStore, useValue: { activeRolePurpose: purpose } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(CloseAccountCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => purpose.set('CLIENT_PORTAL'));

  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('consulta si se puede cerrar y deja el botón activo cuando sí', async () => {
    await crear();

    const boton = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(boton.disabled).toBeFalse();
    expect(texto()).toContain('podrás reactivarla durante 30 días');
    expect(texto()).toContain('Tus mascotas quedarán sin atención programada');
  });

  it('si hay un impedimento lo explica con las palabras del servidor y no deja continuar', async () => {
    await crear(elegible({ eligible: false, reason: 'Tienes citas programadas. Cancélalas antes de cerrar tu cuenta.' }));

    const boton = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(boton.disabled).toBeTrue();
    expect(texto()).toContain('Tienes citas programadas');
  });

  it('un administrador no ve el aviso de las mascotas', async () => {
    purpose.set('COMPANY_ADMIN');
    await crear();

    expect(texto()).not.toContain('Tus mascotas');
  });

  it('la cuenta de plataforma ni siquiera ve la tarjeta ni consulta nada', async () => {
    purpose.set('PLATFORM_ADMIN');
    await crear();

    expect(texto().trim()).toBe('');
    expect(authService.getAccountClosureEligibility).not.toHaveBeenCalled();
  });

  it('con contraseña propia la pide antes de enviar el código', async () => {
    await crear();
    component.open();

    component.sendCode();

    expect(component.error()).toBe('Escribe tu contraseña para continuar.');
    expect(authService.requestAccountClosure).not.toHaveBeenCalled();
  });

  it('envía el código con la contraseña y pasa al paso del código', async () => {
    await crear();
    authService.requestAccountClosure.and.returnValue(of({ success: true, message: 'Te enviamos un código de 6 dígitos a tu correo. Vale 10 minutos.', data: undefined }));
    component.open();
    const ingresado = valorDePrueba();
    component.password.set(ingresado);

    component.sendCode();

    expect(authService.requestAccountClosure).toHaveBeenCalledWith(ingresado);
    expect(component.step()).toBe('code');
    expect(component.info()).toContain('código de 6 dígitos');
  });

  it('quien no tiene contraseña propia solo recibe el código, sin enviar contraseña', async () => {
    await crear(elegible({ requiresPassword: false }));
    authService.requestAccountClosure.and.returnValue(of({ success: true, message: 'ok', data: undefined }));
    component.open();

    component.sendCode();

    expect(authService.requestAccountClosure).toHaveBeenCalledWith(null);
  });

  it('si la contraseña es incorrecta muestra el motivo y se queda en el primer paso', async () => {
    await crear();
    authService.requestAccountClosure.and.returnValue(throwError(() => ({ error: { message: 'La contraseña es incorrecta' } })));
    component.open();
    component.password.set(valorDePrueba());

    component.sendCode();

    expect(component.error()).toBe('La contraseña es incorrecta');
    expect(component.step()).toBe('request');
    expect(component.working()).toBeFalse();
  });

  it('el código debe tener 6 dígitos antes de intentar cerrar', async () => {
    await crear();
    component.open();
    component.code.set('12ab');

    component.confirm();

    expect(component.error()).toBe('El código tiene 6 dígitos.');
    expect(authService.confirmAccountClosure).not.toHaveBeenCalled();
  });

  it('con el código correcto cierra la cuenta y la sesión local con el aviso', async () => {
    await crear();
    authService.confirmAccountClosure.and.returnValue(of({ success: true, message: 'ok', data: undefined }));
    component.open();
    component.code.set(' 482913 ');

    component.confirm();

    expect(authService.confirmAccountClosure).toHaveBeenCalledWith('482913');
    expect(sessionService.closeLocalSession).toHaveBeenCalledWith(undefined, '/cuenta-cerrada');
    expect(component.dialogOpen()).toBeFalse();
  });

  it('con un código incorrecto avisa y no cierra la sesión', async () => {
    await crear();
    authService.confirmAccountClosure.and.returnValue(throwError(() => ({ error: { message: 'El código no es correcto.' } })));
    component.open();
    component.code.set('000000');

    component.confirm();

    expect(component.error()).toBe('El código no es correcto.');
    expect(sessionService.closeLocalSession).not.toHaveBeenCalled();
    expect(component.dialogOpen()).toBeTrue();
  });

  it('cancelar vuelve al inicio y borra lo escrito; no se puede cancelar mientras se envía', async () => {
    await crear();
    component.open();
    component.password.set(valorDePrueba());
    component.working.set(true);

    component.cancel();
    expect(component.dialogOpen()).toBeTrue();

    component.working.set(false);
    component.cancel();
    expect(component.dialogOpen()).toBeFalse();
    component.open();
    expect(component.password()).toBe('');
    expect(component.step()).toBe('request');
  });

  describe('código en casillas y espera para reenviar', () => {
    const OK = { success: true, message: 'Te enviamos un código.', data: undefined };

    async function enPasoDelCodigo() {
      await crear(elegible({ requiresPassword: false }));
      authService.requestAccountClosure.and.returnValue(of(OK));
      component.open();
      fixture.detectChanges();
      component.sendCode();
      fixture.detectChanges();
    }

    const casillas = () =>
      Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('input[aria-label^="Dígito"]')) as HTMLInputElement[];

    function escribir(indice: number, caracter: string, tipo = 'insertText') {
      const campo = casillas()[indice];
      campo.value = caracter;
      campo.dispatchEvent(new InputEvent('input', { data: caracter, inputType: tipo, bubbles: true }));
      fixture.detectChanges();
    }

    const reenviar = () =>
      Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'))
        .find(b => (b.textContent ?? '').includes('Reenviar')) as HTMLButtonElement;

    it('muestra seis casillas, una por dígito', async () => {
      await enPasoDelCodigo();

      expect(casillas().length).toBe(6);
      expect(casillas()[0].getAttribute('autocomplete')).toBe('one-time-code');
      expect(casillas()[1].getAttribute('autocomplete')).toBe('off');
    });

    it('cada dígito pasa a la casilla siguiente y al completar los seis se envía el código', async () => {
      await enPasoDelCodigo();
      authService.confirmAccountClosure.and.returnValue(of({ success: true, message: 'ok', data: undefined }));

      '482913'.split('').forEach((digito, i) => {
        escribir(i, digito);
        if (i < 5) expect(document.activeElement).toBe(casillas()[i + 1]);
      });
      component.confirm();

      expect(component.code()).toBe('482913');
      expect(authService.confirmAccountClosure).toHaveBeenCalledWith('482913');
    });

    it('lo que no es un dígito no entra', async () => {
      await enPasoDelCodigo();

      escribir(0, 'a');

      expect(component.code()).toBe('');
      expect(casillas()[0].value).toBe('');
    });

    it('pegar el código completo llena todas las casillas, aunque traiga espacios o guiones', async () => {
      await enPasoDelCodigo();
      const datos = new DataTransfer();
      datos.setData('text', '482-913 ');

      casillas()[0].dispatchEvent(new ClipboardEvent('paste', { clipboardData: datos, bubbles: true, cancelable: true }));
      fixture.detectChanges();

      expect(component.code()).toBe('482913');
      expect(casillas().map(c => c.value).join('')).toBe('482913');
    });

    it('el autocompletado del código del correo o del SMS también llena todas las casillas', async () => {
      await enPasoDelCodigo();

      escribir(0, '482913', 'insertReplacementText');

      expect(component.code()).toBe('482913');
    });

    it('Retroceso en una casilla vacía borra la anterior y vuelve a ella', async () => {
      await enPasoDelCodigo();
      escribir(0, '4');
      escribir(1, '8');
      expect(component.code()).toBe('48');

      casillas()[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }));
      fixture.detectChanges();

      expect(component.code()).toBe('4');
      expect(document.activeElement).toBe(casillas()[1]);
    });

    it('con una casilla vacía en medio el código no se da por completo', async () => {
      await enPasoDelCodigo();
      escribir(0, '4');
      escribir(2, '2');
      escribir(3, '9');
      escribir(4, '1');
      escribir(5, '3');

      component.confirm();

      expect(component.error()).toBe('El código tiene 6 dígitos.');
      expect(authService.confirmAccountClosure).not.toHaveBeenCalled();
    });

    it('tras enviar el código, reenviar queda bloqueado con una cuenta regresiva y se libera a los 60 segundos', async () => {
      await crear(elegible({ requiresPassword: false }));
      authService.requestAccountClosure.and.returnValue(of(OK));
      component.open();

      fakeAsync(() => {
        component.sendCode();
        fixture.detectChanges();
        expect(component.cooldown()).toBe(60);
        expect(reenviar().disabled).toBeTrue();
        expect(reenviar().textContent).toContain('Reenviar código en 1:00');

        component.sendCode();
        expect(authService.requestAccountClosure).toHaveBeenCalledTimes(1);

        tick(30000);
        fixture.detectChanges();
        expect(component.cooldown()).toBe(30);
        expect(reenviar().textContent).toContain('Reenviar código en 30 s');

        tick(30000);
        fixture.detectChanges();
        expect(component.cooldown()).toBe(0);
        expect(reenviar().disabled).toBeFalse();
        expect(reenviar().textContent?.trim()).toBe('Reenviar código');

        component.sendCode();
        expect(authService.requestAccountClosure).toHaveBeenCalledTimes(2);
        discardPeriodicTasks();
      })();
    });

    it('si el servidor pide esperar más en cada reenvío, la cuenta regresiva usa ese tiempo y lo muestra en minutos', async () => {
      await crear(elegible({ requiresPassword: false }));
      authService.requestAccountClosure.and.returnValues(
        of({ ...OK, data: { retryAfterSeconds: 60 } }),
        of({ ...OK, data: { retryAfterSeconds: 120 } }));
      component.open();

      fakeAsync(() => {
        component.sendCode();
        tick(60000);
        component.sendCode();
        fixture.detectChanges();

        expect(component.cooldown()).toBe(120);
        expect(reenviar().disabled).toBeTrue();
        expect(reenviar().textContent).toContain('Reenviar código en 2:00');

        tick(61000);
        fixture.detectChanges();
        expect(reenviar().textContent).toContain('Reenviar código en 59 s');
        expect(reenviar().disabled).toBeTrue();

        tick(59000);
        fixture.detectChanges();
        expect(reenviar().disabled).toBeFalse();
        discardPeriodicTasks();
      })();
    });

    it('si el servidor dice que falta esperar, la pantalla cuenta esos segundos y lo explica', async () => {
      await crear(elegible({ requiresPassword: false }));
      authService.requestAccountClosure.and.returnValue(throwError(() => ({
        status: 429, error: { message: 'Espera 42 segundos antes de pedir otro código.', data: { retryAfterSeconds: 42 } }
      })));
      component.open();

      fakeAsync(() => {
        component.sendCode();
        fixture.detectChanges();

        expect(component.cooldown()).toBe(42);
        expect(component.step()).toBe('request');
        expect(texto()).toContain('Espera 42 segundos antes de pedir otro código.');
        discardPeriodicTasks();
      })();
    });

    it('cancelar y volver a abrir no reinicia la espera', async () => {
      await crear(elegible({ requiresPassword: false }));
      authService.requestAccountClosure.and.returnValue(of(OK));
      component.open();

      fakeAsync(() => {
        component.sendCode();
        component.cancel();
        component.open();
        fixture.detectChanges();

        expect(component.cooldown()).toBeGreaterThan(0);
        component.sendCode();
        expect(authService.requestAccountClosure).toHaveBeenCalledTimes(1);
        discardPeriodicTasks();
      })();
    });
  });

  describe('diálogo de cierre', () => {
    const OK = { success: true, message: 'Te enviamos un código.', data: undefined };
    const dialogo = () => (fixture.nativeElement as HTMLElement).querySelector('[role="dialog"]') as HTMLElement | null;
    const campoClave = () => (fixture.nativeElement as HTMLElement).querySelector('#close-password') as HTMLInputElement;

    it('el primer paso explica qué va a pasar y la contraseña se puede mostrar u ocultar', async () => {
      await crear();
      component.open();
      fixture.detectChanges();

      expect(dialogo()?.getAttribute('aria-modal')).toBe('true');
      expect(dialogo()?.textContent).toContain('Confirma que eres tú');
      expect(dialogo()?.textContent).toContain('código de 6 dígitos');
      expect(campoClave().type).toBe('password');

      component.togglePassword();
      fixture.detectChanges();
      expect(campoClave().type).toBe('text');

      component.togglePassword();
      fixture.detectChanges();
      expect(campoClave().type).toBe('password');
    });

    it('sin contraseña propia no se muestra el campo', async () => {
      await crear(elegible({ requiresPassword: false }));
      component.open();
      fixture.detectChanges();

      expect(campoClave()).toBeNull();
      expect(dialogo()?.textContent).toContain('Enviarme el código');
    });

    it('Enter en la contraseña envía el código', async () => {
      await crear();
      authService.requestAccountClosure.and.returnValue(of(OK));
      component.open();
      fixture.detectChanges();
      const clave = valorDePrueba();
      campoClave().value = clave;
      campoClave().dispatchEvent(new Event('input'));

      campoClave().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

      expect(authService.requestAccountClosure).toHaveBeenCalledWith(clave);
    });

    it('el segundo paso avisa que es irreversible salvo por el enlace de 30 días y deja el botón de cerrar', async () => {
      await crear(elegible({ requiresPassword: false }));
      authService.requestAccountClosure.and.returnValue(of(OK));
      component.open();
      component.sendCode();
      fixture.detectChanges();

      expect(dialogo()?.textContent).toContain('Escribe el código');
      expect(dialogo()?.textContent).toContain('Podrás reactivarla durante 30 días');
      expect(dialogo()?.textContent).toContain('Cerrar mi cuenta');
      expect(dialogo()?.textContent).toContain('Cancelar');
    });

    it('al pasar al segundo paso el cursor queda en la primera casilla del código', async () => {
      await crear(elegible({ requiresPassword: false }));
      authService.requestAccountClosure.and.returnValue(of(OK));
      component.open();
      component.sendCode();
      fixture.detectChanges();
      await fixture.whenStable();

      const primera = (fixture.nativeElement as HTMLElement).querySelector('input[aria-label="Dígito 1 de 6"]');
      expect(document.activeElement).toBe(primera);
    });

    it('Escape y Cancelar cierran el diálogo y lo dejan listo para la próxima vez', async () => {
      await crear();
      component.open();
      fixture.detectChanges();
      component.togglePassword();

      dialogo()!.parentElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();

      expect(dialogo()).toBeNull();
      component.open();
      expect(component.showPassword()).toBeFalse();
    });
  });
});
