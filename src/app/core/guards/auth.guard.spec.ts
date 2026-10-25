import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { Observable, of } from 'rxjs';
import { AuthGuard } from './auth.guard';
import { SessionService } from '../services/session.service';
import { CompanySlugContext } from '../services/company-slug-context.service';
import { AuthStore } from '../../store/auth.store';
import { AvisoClinicaGate } from '../services/aviso-clinica-gate.service';

describe('AuthGuard - sesión de otra clínica', () => {
  let sessionService: any;
  let slug: string | null;
  let avisoGate: { debeMostrarse: jasmine.Spy };

  beforeEach(() => {
    slug = 'clinica-b';
    sessionService = {
      initialize: jasmine.createSpy('initialize'),
      sessionConflict: Object.assign(() => conflicto, { set: (valor: boolean) => { conflicto = valor; } })
    };
    conflicto = false;
    avisoGate = { debeMostrarse: jasmine.createSpy('debeMostrarse').and.returnValue(of(false)) };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SessionService, useValue: sessionService },
        { provide: CompanySlugContext, useValue: { slug: () => slug } },
        { provide: AvisoClinicaGate, useValue: avisoGate },
        { provide: AuthStore, useValue: { menu: () => [], activeRoleId: () => 1, activeRolePurpose: () => 'COMPANY_ADMIN', hasRouteAccess: () => true, hasAccess: () => true, logout: () => {} } },
      ],
    });
  });

  let conflicto = false;

  const ejecutar = (url?: string) => TestBed.runInInjectionContext(() =>
    AuthGuard({ data: {}, pathFromRoot: [] } as unknown as ActivatedRouteSnapshot, { url } as RouterStateSnapshot)) as Observable<boolean | UrlTree>;

  it('le pasa a la sesión la clínica de la dirección para compararla', (done) => {
    sessionService.initialize.and.returnValue(of(true));

    ejecutar().subscribe(() => {
      expect(sessionService.initialize).toHaveBeenCalledWith('clinica-b');
      done();
    });
  });

  it('si la sesión del navegador es de otra clínica manda al login con el aviso y apaga el conflicto', (done) => {
    sessionService.initialize.and.returnValue(of(false));
    conflicto = true;

    ejecutar().subscribe((resultado) => {
      const router = TestBed.inject(Router);
      expect(router.serializeUrl(resultado as UrlTree)).toContain('authNotice=sesion_actualizada');
      expect(conflicto).toBeFalse();
      done();
    });
  });

  it('sin sesión y sin conflicto manda al login simple', (done) => {
    sessionService.initialize.and.returnValue(of(false));

    ejecutar().subscribe((resultado) => {
      const router = TestBed.inject(Router);
      expect(router.serializeUrl(resultado as UrlTree)).not.toContain('authNotice');
      done();
    });
  });

  it('con el aviso de la clínica pendiente de ver, lleva a la pantalla del aviso', (done) => {
    sessionService.initialize.and.returnValue(of(true));
    avisoGate.debeMostrarse.and.returnValue(of(true));

    ejecutar('/dashboard').subscribe((resultado) => {
      const router = TestBed.inject(Router);
      expect(router.serializeUrl(resultado as UrlTree)).toBe('/aviso-clinica');
      done();
    });
  });

  it('sin aviso pendiente deja pasar', (done) => {
    sessionService.initialize.and.returnValue(of(true));

    ejecutar('/dashboard').subscribe((resultado) => {
      expect(resultado).toBeTrue();
      done();
    });
  });

  it('no vuelve a pedir el aviso en su propia pantalla ni al cambiar la contraseña', (done) => {
    sessionService.initialize.and.returnValue(of(true));
    avisoGate.debeMostrarse.and.returnValue(of(true));

    ejecutar('/aviso-clinica').subscribe((a) => {
      ejecutar('/password-change').subscribe((b) => {
          expect([a, b]).toEqual([true, true]);
          expect(avisoGate.debeMostrarse).not.toHaveBeenCalled();
          done();
      });
    });
  });

  it('la exención también vale cuando la dirección trae la clínica al inicio, como al abrir un enlace directo', (done) => {
    sessionService.initialize.and.returnValue(of(true));
    avisoGate.debeMostrarse.and.returnValue(of(true));

    ejecutar('/vargasvet-e2e/aviso-clinica').subscribe((a) => {
        ejecutar('/vargasvet-e2e/password-change#a').subscribe((b) => {
          expect([a, b]).toEqual([true, true]);
          expect(avisoGate.debeMostrarse).not.toHaveBeenCalled();
          done();
      });
    });
  });

  it('con la clínica en la dirección, las demás pantallas siguen yendo al aviso mientras esté pendiente', (done) => {
    sessionService.initialize.and.returnValue(of(true));
    avisoGate.debeMostrarse.and.returnValue(of(true));

    ejecutar('/vargasvet-e2e/admin/privacidad').subscribe((resultado) => {
      const router = TestBed.inject(Router);
      expect(router.serializeUrl(resultado as UrlTree)).toBe('/aviso-clinica');
      expect(avisoGate.debeMostrarse).toHaveBeenCalledTimes(1);
      done();
    });
  });

  it('una pantalla que solo se parece al nombre de una exención no queda exenta', (done) => {
    sessionService.initialize.and.returnValue(of(true));
    avisoGate.debeMostrarse.and.returnValue(of(true));

    ejecutar('/vargasvet-e2e/mascotas/aviso-clinica-falso').subscribe(() => {
      expect(avisoGate.debeMostrarse).toHaveBeenCalledTimes(1);
      done();
    });
  });

  it('sin sesión no consulta el aviso', (done) => {
    sessionService.initialize.and.returnValue(of(false));

    ejecutar('/dashboard').subscribe(() => {
      expect(avisoGate.debeMostrarse).not.toHaveBeenCalled();
      done();
    });
  });
});

describe('AuthGuard - acceso a pantallas sin permiso', () => {
  function ejecutar(store: Record<string, unknown>, route: Partial<ActivatedRouteSnapshot>) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SessionService, useValue: { initialize: () => of(true), sessionConflict: Object.assign(() => false, { set: () => {} }) } },
        { provide: CompanySlugContext, useValue: { slug: () => null } },
        { provide: AvisoClinicaGate, useValue: { debeMostrarse: () => of(false) } },
        {
          provide: AuthStore,
          useValue: { menu: () => [{ ruta: 'apoderado/dashboard' }], activeRoleId: () => 1, activeRolePurpose: () => 'CLIENT_PORTAL', logout: () => {}, ...store }
        }
      ]
    });
    return TestBed.runInInjectionContext(() =>
      AuthGuard(route as ActivatedRouteSnapshot, { url: '/x' } as RouterStateSnapshot)) as Observable<boolean | UrlTree>;
  }
  const serializar = (r: boolean | UrlTree) => TestBed.inject(Router).serializeUrl(r as UrlTree);

  it('una ruta que su rol no puede ver lleva a la página de acceso denegado', (done) => {
    ejecutar({ hasRouteAccess: () => false, hasAccess: () => true },
      { data: {}, pathFromRoot: [{ routeConfig: { path: 'caja' } }] as never }).subscribe((resultado) => {
      expect(serializar(resultado)).toBe('/acceso-denegado');
      done();
    });
  });

  it('una ventana sin el permiso requerido lleva a la página de acceso denegado', (done) => {
    ejecutar({ hasRouteAccess: () => true, hasAccess: () => false },
      { data: { ventana: 'VISTA_CAJA', permiso: 'leer' }, pathFromRoot: [] }).subscribe((resultado) => {
      expect(serializar(resultado)).toBe('/acceso-denegado');
      done();
    });
  });

  it('una pantalla reservada a otro tipo de rol lleva a la página de acceso denegado', (done) => {
    ejecutar({ hasRouteAccess: () => true, hasAccess: () => true },
      { data: { purposes: ['PLATFORM_ADMIN'] }, pathFromRoot: [] }).subscribe((resultado) => {
      expect(serializar(resultado)).toBe('/acceso-denegado');
      done();
    });
  });

  it('con permiso deja pasar', (done) => {
    ejecutar({ hasRouteAccess: () => true, hasAccess: () => true },
      { data: {}, pathFromRoot: [{ routeConfig: { path: 'mascotas' } }] as never }).subscribe((resultado) => {
      expect(resultado).toBeTrue();
      done();
    });
  });
});
