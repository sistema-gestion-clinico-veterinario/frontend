import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AccountClosedComponent } from './account-closed.component';
import { CompanyService } from '../../../core/services/company.service';
import { CompanySlugContext } from '../../../core/services/company-slug-context.service';

describe('AccountClosedComponent', () => {
  let fixture: ComponentFixture<AccountClosedComponent>;
  let companyService: jasmine.SpyObj<CompanyService>;

  function crear(slug: string | null, marca: any = of({ success: true, message: '', data: { name: 'Clínica Patitas', logoUrl: null, colorPrimario: '#0a7d8c' } })) {
    companyService = jasmine.createSpyObj<CompanyService>('CompanyService', ['getBrandingBySlug']);
    companyService.getBrandingBySlug.and.returnValue(marca);
    TestBed.configureTestingModule({
      imports: [AccountClosedComponent],
      providers: [
        provideRouter([]),
        { provide: CompanyService, useValue: companyService },
        { provide: CompanySlugContext, useValue: { slug: signal(slug).asReadonly() } }
      ]
    });
    fixture = TestBed.createComponent(AccountClosedComponent);
    fixture.detectChanges();
  }

  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('explica de forma permanente que la cuenta se cerró, el plazo de 30 días y cómo volver iniciando sesión', () => {
    crear('clinica-patitas');

    expect(texto()).toContain('Tu cuenta fue cerrada');
    expect(texto()).toContain('Cerraste tu cuenta en Clínica Patitas');
    expect(texto()).toContain('Puedes reactivarla durante 30 días');
    expect(texto()).toContain('iniciar sesión de nuevo');
    expect(texto()).not.toContain('correo');
    expect(texto()).toContain('tendrá que registrarte de nuevo');
  });

  it('ofrece volver al inicio de sesión', () => {
    crear('clinica-patitas');

    const enlace = (fixture.nativeElement as HTMLElement).querySelector('a') as HTMLAnchorElement;
    expect(enlace.textContent).toContain('Ir al inicio de sesión');
    expect(enlace.getAttribute('href')).toContain('login');
  });

  it('toma la marca de la clínica de la dirección', () => {
    crear('clinica-patitas');

    expect(companyService.getBrandingBySlug).toHaveBeenCalledWith('clinica-patitas');
  });

  it('sin clínica en la dirección o si la marca no carga, igual muestra el mensaje con la marca genérica', () => {
    crear(null);
    expect(companyService.getBrandingBySlug).not.toHaveBeenCalled();
    expect(texto()).toContain('Tu cuenta fue cerrada');

    TestBed.resetTestingModule();
    crear('clinica-patitas', throwError(() => ({ status: 500 })));
    expect(texto()).toContain('Tu cuenta fue cerrada');
  });
});
