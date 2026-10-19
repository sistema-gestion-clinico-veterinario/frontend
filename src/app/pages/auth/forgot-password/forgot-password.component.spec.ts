import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ForgotPasswordComponent } from './forgot-password.component';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

describe('ForgotPasswordComponent', () => {
  let component: ForgotPasswordComponent;
  let fixture: ComponentFixture<ForgotPasswordComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent, HttpClientTestingModule],
    })
    .overrideComponent(ForgotPasswordComponent, { set: { template: '' } })
    .compileComponents();

    fixture = TestBed.createComponent(ForgotPasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('no revela si el correo está registrado aunque el servidor envíe un mensaje diferente', () => {
    component.forgotForm.setValue({ email: 'persona@example.com' });

    component.submit();

    const http = TestBed.inject(HttpTestingController);
    const request = http.expectOne(req => req.url.endsWith('/auth/forgot-password'));
    request.flush({ success: true, message: 'La cuenta existe', data: null });
    expect(component.successMessage).toBe(
      'Si el correo se encuentra registrado, recibirás un mensaje con las instrucciones para restablecer tu contraseña.'
    );
  });
});
