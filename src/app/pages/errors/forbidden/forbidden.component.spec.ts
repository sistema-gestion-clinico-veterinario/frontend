import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ForbiddenComponent } from './forbidden.component';
import { AuthStore } from '../../../store/auth.store';

describe('ForbiddenComponent', () => {
  let router: { navigateByUrl: jasmine.Spy };
  let location: jasmine.SpyObj<Location>;

  function crear(menu: unknown[]) {
    router = { navigateByUrl: jasmine.createSpy('navigateByUrl') };
    location = jasmine.createSpyObj('Location', ['back']);
    TestBed.configureTestingModule({
      imports: [ForbiddenComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: Location, useValue: location },
        { provide: AuthStore, useValue: { menu: () => menu, activeRolePurpose: () => 'CLIENT_PORTAL' } }
      ]
    });
    const fixture = TestBed.createComponent(ForbiddenComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('explica que el rol no tiene permiso y sugiere pedir ayuda al administrador', () => {
    const texto = (crear([{ ruta: 'apoderado/dashboard', leer: true, activo: true }]).nativeElement as HTMLElement).textContent;
    expect(texto).toContain('No tienes acceso a esta página');
    expect(texto).toContain('administrador de tu clínica');
    expect(texto).toContain('Ir a mi inicio');
  });

  it('lleva a la primera pantalla permitida de su menú', () => {
    const fixture = crear([{ ruta: 'apoderado/dashboard', leer: true, activo: true }]);
    fixture.componentInstance.irAlInicio();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/apoderado/dashboard');
  });

  it('sin sesión ofrece ir al inicio de sesión', () => {
    const fixture = crear([]);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Ir al inicio de sesión');
    fixture.componentInstance.irAlInicio();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('si no hay historial al que volver, va al inicio', () => {
    const fixture = crear([]);
    spyOnProperty(window.history, 'length').and.returnValue(1);
    fixture.componentInstance.volver();
    expect(location.back).not.toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });
});
