import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NotFoundComponent } from './not-found.component';
import { AuthStore } from '../../../store/auth.store';

describe('NotFoundComponent', () => {
  let router: { url: string; navigateByUrl: jasmine.Spy };
  let location: jasmine.SpyObj<Location>;

  function crear(menu: unknown[] = []) {
    router = { url: '/clientes/no-existe?x=1', navigateByUrl: jasmine.createSpy('navigateByUrl') };
    location = jasmine.createSpyObj('Location', ['back']);
    TestBed.configureTestingModule({
      imports: [NotFoundComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: Location, useValue: location },
        { provide: AuthStore, useValue: { menu: () => menu, activeRolePurpose: () => 'COMPANY_ADMIN' } }
      ]
    });
    const fixture = TestBed.createComponent(NotFoundComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('explica el error sin mostrar la dirección solicitada', () => {
    const el = crear().nativeElement as HTMLElement;
    expect(el.textContent).toContain('No encontramos esta página');
    expect(el.querySelector('code')).toBeNull();
  });

  it('sin sesión lleva al inicio de sesión', () => {
    const fixture = crear([]);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Ir al inicio de sesión');
    fixture.componentInstance.irAlInicio();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('con sesión lleva a la primera pantalla disponible de su menú', () => {
    const fixture = crear([{ ruta: 'admin/dashboard', leer: true, activo: true, vistas: undefined }]);
    fixture.componentInstance.irAlInicio();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/admin/dashboard');
  });

  it('volver atrás usa el historial del navegador', () => {
    const fixture = crear();
    spyOnProperty(window.history, 'length').and.returnValue(5);
    fixture.componentInstance.volver();
    expect(location.back).toHaveBeenCalled();
  });
});
