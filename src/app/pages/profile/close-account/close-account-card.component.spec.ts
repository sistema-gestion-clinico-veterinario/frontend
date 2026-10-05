import { ComponentFixture, TestBed } from '@angular/core/testing';
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
    component.password.set('Clave-123');

    component.sendCode();

    expect(authService.requestAccountClosure).toHaveBeenCalledWith('Clave-123');
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
    component.password.set('mala');

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
    expect(sessionService.closeLocalSession).toHaveBeenCalledWith('cuenta_cerrada');
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
    component.password.set('algo');
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
});
