import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MenuItemDTO } from '../../models/response/auth-login-response.model';
import { AuthStore } from '../../store/auth.store';
import { GuidedTourService, GuidedTourStep } from './guided-tour.service';
import { RouteMapperService } from './route-mapper.service';

describe('GuidedTourService', () => {
  const storageKey = 'softvet:onboarding:inicio-softvet:v1:u25:c3:r7';
  const purpose = signal('CUSTOM');
  const menu = signal<MenuItemDTO[]>([]);
  const availableRoles = signal<{ id: number; name: string }[]>([]);
  let service: GuidedTourService;

  const view = (codigo: string): MenuItemDTO => ({
    id: 1,
    codigo,
    nombre: codigo,
    activo: true,
    orden: 1,
    leer: true,
    escribir: true,
    modificar: true,
    eliminar: false
  });

  beforeEach(() => {
    localStorage.removeItem(storageKey);
    purpose.set('CUSTOM');
    menu.set([]);
    availableRoles.set([]);
    TestBed.configureTestingModule({
      providers: [
        GuidedTourService,
        RouteMapperService,
        {
          provide: AuthStore,
          useValue: {
            activeRolePurpose: purpose,
            activeRoleId: () => 7,
            companyId: () => 3,
            token: () => 'header.eyJ1c2VySWQiOjI1LCJzdWIiOiJhbmFAZXhhbXBsZS5jb20ifQ.signature',
            menu,
            availableRoles
          }
        },
        {
          provide: Router,
          useValue: { url: '/dashboard', navigateByUrl: jasmine.createSpy('navigateByUrl') }
        }
      ]
    });
    service = TestBed.inject(GuidedTourService);
  });

  it('usa la agenda y las historias correspondientes al administrador de clínica', () => {
    menu.set([view('VISTA_CITAS_AGENDA_ADMIN'), view('VISTA_HISTORIAS_ADMIN')]);

    const steps = buildSteps();

    expect(steps.some(step => step.selector === '[data-tour-menu="VISTA_CITAS_AGENDA_ADMIN"]')).toBeTrue();
    expect(steps.find(step => step.id === 'appointment-create')?.route).toBe('/admin/citas/agenda');
    expect(steps.some(step => step.selector === '[data-tour-menu="VISTA_HISTORIAS_ADMIN"]')).toBeTrue();
  });

  it('no ofrece acciones de agenda cuando el rol no tiene esa vista', () => {
    menu.set([view('VISTA_HISTORIAS_EMPLEADO')]);

    const steps = buildSteps();

    expect(steps.some(step => step.id === 'appointment-create')).toBeFalse();
    expect(steps.some(step => step.id === 'appointment-modal')).toBeFalse();
  });

  it('incluye el cambio de rol solo cuando la persona tiene varios roles disponibles', () => {
    availableRoles.set([{ id: 7, name: 'ADMIN' }]);
    expect(buildSteps().some(step => step.id === 'active-role-selector')).toBeFalse();

    availableRoles.set([
      { id: 7, name: 'ADMIN' },
      { id: 8, name: 'VETERINARIO' }
    ]);

    const step = buildSteps().find(item => item.id === 'active-role-selector');
    expect(step?.selector).toBe('[data-tour="active-role-selector"]');
    expect(step?.title).toBe('Cambiar de rol');
  });

  it('no vuelve a ofrecer automáticamente una guía ya descartada en este navegador', () => {
    localStorage.setItem(storageKey, 'POSPUESTA');

    service.initialize();

    expect(service.offerVisible()).toBeFalse();
  });

  function buildSteps(): GuidedTourStep[] {
    return (service as unknown as { buildSteps(): GuidedTourStep[] }).buildSteps();
  }
});
