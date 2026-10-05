import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { Observable, of } from 'rxjs';
import { AuthGuard } from './auth.guard';
import { SessionService } from '../services/session.service';
import { CompanySlugContext } from '../services/company-slug-context.service';
import { AuthStore } from '../../store/auth.store';

describe('AuthGuard - sesión de otra clínica', () => {
  let sessionService: any;
  let slug: string | null;

  beforeEach(() => {
    slug = 'clinica-b';
    sessionService = {
      initialize: jasmine.createSpy('initialize'),
      sessionConflict: Object.assign(() => conflicto, { set: (valor: boolean) => { conflicto = valor; } })
    };
    conflicto = false;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SessionService, useValue: sessionService },
        { provide: CompanySlugContext, useValue: { slug: () => slug } },
        { provide: AuthStore, useValue: { menu: () => [], activeRoleId: () => 1, activeRolePurpose: () => 'COMPANY_ADMIN', hasRouteAccess: () => true, hasAccess: () => true, logout: () => {} } },
      ],
    });
  });

  let conflicto = false;

  const ejecutar = () => TestBed.runInInjectionContext(() =>
    AuthGuard({ data: {}, pathFromRoot: [] } as unknown as ActivatedRouteSnapshot, {} as RouterStateSnapshot)) as Observable<boolean | UrlTree>;

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
      expect(router.serializeUrl(resultado as UrlTree)).toContain('authNotice=sesion_otra_clinica');
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
});
