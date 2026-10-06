import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { ReactivateAccountComponent } from './reactivate-account.component';
import { AuthService } from '../../../core/services/auth.service';
import { CompanyService } from '../../../core/services/company.service';
import { CompanySlugContext } from '../../../core/services/company-slug-context.service';

describe('ReactivateAccountComponent', () => {
  let authService: jasmine.SpyObj<AuthService>;

  function crear(fragment: string | null, slug: string | null = null) {
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['reactivateAccount']);
    const companyService = jasmine.createSpyObj<CompanyService>('CompanyService', ['getBrandingBySlug']);
    companyService.getBrandingBySlug.and.returnValue(of({ success: true, message: 'ok', data: { name: 'Vargas Vet', logoUrl: null, colorPrimario: '#123456' } } as any));
    TestBed.configureTestingModule({
      imports: [ReactivateAccountComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: CompanyService, useValue: companyService },
        { provide: CompanySlugContext, useValue: { slug: () => slug } },
        { provide: ActivatedRoute, useValue: { snapshot: { fragment } } },
      ],
    });
    const fixture = TestBed.createComponent(ReactivateAccountComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, companyService };
  }

  it('lee el enlace del fragmento, lo quita de la barra de direcciones y espera el clic antes de reactivar', () => {
    const reemplazo = spyOn(history, 'replaceState');
    const { component } = crear('token=abc123');

    expect(component.token).toBe('abc123');
    expect(component.state()).toBe('ready');
    expect(reemplazo).toHaveBeenCalled();
    expect(authService.reactivateAccount).not.toHaveBeenCalled();
  });

  it('sin enlace muestra un error claro y no llama al servidor', () => {
    const { component, fixture } = crear(null);

    expect(component.state()).toBe('error');
    expect(fixture.nativeElement.textContent).toContain('No pudimos reactivarla');
    component.reactivate();
    expect(authService.reactivateAccount).not.toHaveBeenCalled();
  });

  it('al reactivar muestra el éxito y el acceso al inicio de sesión', () => {
    spyOn(history, 'replaceState');
    const { component, fixture } = crear('token=abc123');
    authService.reactivateAccount.and.returnValue(of({ success: true, message: 'Reactivamos tu cuenta. Ya puedes iniciar sesión.', data: undefined }));

    component.reactivate();
    fixture.detectChanges();

    expect(authService.reactivateAccount).toHaveBeenCalledWith('abc123');
    expect(component.state()).toBe('done');
    expect(fixture.nativeElement.textContent).toContain('Tu cuenta está activa');
    expect(fixture.nativeElement.textContent).toContain('Iniciar sesión');
  });

  it('si el enlace venció explica qué hacer pasados los 30 días', () => {
    spyOn(history, 'replaceState');
    const { component, fixture } = crear('token=viejo');
    authService.reactivateAccount.and.returnValue(throwError(() => ({ status: 404, error: { message: 'El enlace no es válido o ya venció' } })));

    component.reactivate();
    fixture.detectChanges();

    expect(component.state()).toBe('error');
    expect(component.message()).toBe('El enlace no es válido o ya venció');
    expect(fixture.nativeElement.textContent).toContain('más de 30 días');
  });

  it('un segundo clic mientras se reactiva no repite la llamada', () => {
    spyOn(history, 'replaceState');
    const { component } = crear('token=abc123');
    authService.reactivateAccount.and.returnValue(new Subject<any>());

    component.reactivate();
    component.reactivate();

    expect(authService.reactivateAccount).toHaveBeenCalledTimes(1);
  });

  it('con la clínica en la dirección carga su nombre y color', () => {
    spyOn(history, 'replaceState');
    const { component, companyService } = crear('token=abc123', 'vargas-vet');

    expect(companyService.getBrandingBySlug).toHaveBeenCalledWith('vargas-vet');
    expect(component.companyName).toBe('Vargas Vet');
    expect(component.colorPrimario).toBe('#123456');
  });
});
