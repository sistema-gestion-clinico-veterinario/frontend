import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ForgotPasswordComponent } from './forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './reset-password/reset-password.component';
import { VerifyEmailComponent } from './verify-email/verify-email.component';

const PAGINAS: Array<{ nombre: string; clase: Type<unknown>; selector: string }> = [
  { nombre: 'recuperar contraseña', clase: ForgotPasswordComponent, selector: '.forgot-hero__pet-image' },
  { nombre: 'restablecer contraseña', clase: ResetPasswordComponent, selector: '.reset-hero__pet-image' },
  { nombre: 'verificar correo', clase: VerifyEmailComponent, selector: '.verify-hero__pet-image' }
];

for (const pagina of PAGINAS) {
  describe(`Imagen decorativa — ${pagina.nombre}`, () => {
    let imagen: HTMLImageElement;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [pagina.clase, HttpClientTestingModule],
        providers: [provideRouter([])]
      }).compileComponents();

      const fixture = TestBed.createComponent(pagina.clase);
      fixture.detectChanges();
      imagen = fixture.nativeElement.querySelector(pagina.selector);
    });

    it('usa la ilustración del propio sitio y no una de otro origen', () => {
      expect(imagen).not.toBeNull();
      expect(imagen.getAttribute('src')).toBe('/assets/images/login-pets.webp');
    });

    it('se carga de forma diferida para no descargarse cuando el contenedor está oculto', () => {
      expect(imagen.getAttribute('loading')).toBe('lazy');
    });

    it('declara su tamaño para reservar el espacio', () => {
      expect(imagen.getAttribute('width')).toBe('467');
      expect(imagen.getAttribute('height')).toBe('456');
    });
  });
}
