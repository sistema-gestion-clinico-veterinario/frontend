import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AdminEmailChangeModalComponent } from './admin-email-change-modal.component';
import { AuthService } from '../../../../core/services/auth.service';

describe('AdminEmailChangeModalComponent', () => {
  let fixture: ComponentFixture<AdminEmailChangeModalComponent>;
  let component: AdminEmailChangeModalComponent;
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['adminChangeEmail']);
    TestBed.configureTestingModule({
      imports: [AdminEmailChangeModalComponent],
      providers: [{ provide: AuthService, useValue: authService }]
    });
    fixture = TestBed.createComponent(AdminEmailChangeModalComponent);
    component = fixture.componentInstance;
    component.userId = 20;
    component.displayName = 'Ana Pérez';
    component.currentEmail = 'sin.acceso@correo.com';
    fixture.detectChanges();
  });

  it('no deja enviar si el correo repetido no coincide', () => {
    component.form.setValue({ newEmail: 'nuevo@correo.com', confirmEmail: 'nuevo@correo.org', motivo: '' });

    expect(component.form.invalid).toBeTrue();
    component.submit();

    expect(authService.adminChangeEmail).not.toHaveBeenCalled();
  });

  it('envía el correo cuando coincide y entrega el mensaje que respondió el servidor', () => {
    authService.adminChangeEmail.and.returnValue(of({ success: true, message: 'Enviamos un enlace de confirmación', data: undefined } as any));
    let mensaje = '';
    component.sent.subscribe(m => mensaje = m);
    component.form.setValue({ newEmail: 'nuevo@correo.com', confirmEmail: 'nuevo@correo.com', motivo: 'DNI en mostrador' });

    component.submit();

    expect(authService.adminChangeEmail).toHaveBeenCalledWith(20, 'nuevo@correo.com', 'DNI en mostrador');
    expect(mensaje).toBe('Enviamos un enlace de confirmación');
  });

  it('en una cuenta sin activar explica que se corrige en el acto y se invita de nuevo', () => {
    component.pending = true;
    fixture.detectChanges();

    const texto = (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');
    expect(texto).toContain('Corregir correo');
    expect(texto).toContain('el cambio se aplica de inmediato');
  });

  it('en una cuenta ya activada avisa de lo que pasa con quien entra con Google', () => {
    const texto = (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');
    expect(texto).toContain('Cambiar correo de acceso');
    expect(texto).toContain('Google');
  });
});
