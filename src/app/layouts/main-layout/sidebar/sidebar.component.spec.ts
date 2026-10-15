import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { SidebarComponent } from './sidebar.component';
import { AuthStore } from '../../../store/auth.store';
import { MediaService } from '../../../core/services/media.service';
import { AuthService } from '../../../core/services/auth.service';
import { SessionService } from '../../../core/services/session.service';
import { CompanyComplianceService } from '../../../core/services/company-compliance.service';
import { GuidedTourService } from '../../../core/services/guided-tour.service';
import { of } from 'rxjs';
import { MenuItemDTO, MenuStructureDTO } from '../../../models/response/auth-login-response.model';

describe('SidebarComponent - navegación permitida', () => {
  let fixture: ComponentFixture<SidebarComponent>;
  let component: SidebarComponent;
  const menu = signal<(MenuItemDTO | MenuStructureDTO)[]>([]);
  const activeRoleId = signal<number | null>(7);

  const vista = (id: number, codigo: string, nombre: string, parcial: Partial<MenuItemDTO> = {}): MenuItemDTO => ({
    id, codigo, nombre, activo: true, orden: id, leer: true, escribir: false, modificar: false, eliminar: false, ...parcial
  });
  const plana = (item: MenuItemDTO, orden = item.orden ?? 0): MenuStructureDTO => ({
    ventanaNombre: item.nombre, presentacion: 'FLAT', orden, vistas: [item]
  });
  const html = () => fixture.nativeElement as HTMLElement;
  const texto = () => html().textContent?.replace(/\s+/g, ' ') ?? '';
  const nombres = () => component.menuStructure().flatMap(s => s.vistas.map(v => v.codigo));
  const mostrar = (items: (MenuItemDTO | MenuStructureDTO)[]) => {
    menu.set(items);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    menu.set([]);
    activeRoleId.set(7);
    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: {
            menu,
            activeRoleId,
            activeRolePurpose: () => 'CUSTOM',
            nombreCompleto: () => 'Ana Torres',
            activeRoleName: () => 'ROLE_VETERINARIO',
            selectedEnterprise: () => null,
            companyName: () => 'Clínica Patitas',
            loadingEnterprise: () => false,
          }
        },
        { provide: MediaService, useValue: { resolveUrl: (u: string | null | undefined) => u ?? null } },
        { provide: AuthService, useValue: {} },
        { provide: SessionService, useValue: { logout: jasmine.createSpy('logout') } },
        { provide: CompanyComplianceService, useValue: { actualesDeMiClinica: () => of({ data: [] }) } },
        { provide: GuidedTourService, useValue: { initialize: () => {}, start: () => {}, postpone: () => {}, offerVisible: () => false } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(SidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('muestra solo las entradas que el backend entregó para el rol activo', () => {
    mostrar([plana(vista(1, 'VISTA_CLIENTES', 'Clientes')), plana(vista(2, 'VISTA_PROFILE', 'Mi perfil'))]);

    const enlaces = [...html().querySelectorAll('a')].map(a => a.textContent?.trim());
    expect(enlaces).toEqual(jasmine.arrayContaining(['Clientes', 'Mi perfil']));
    expect(texto()).not.toContain('Roles');
    expect(texto()).not.toContain('Auditoría');
  });

  it('no dibuja una entrada si el permiso de lectura no está concedido', () => {
    mostrar([
      plana(vista(1, 'VISTA_CLIENTES', 'Clientes', { leer: false })),
      plana(vista(2, 'VISTA_PROFILE', 'Mi perfil')),
    ]);

    expect(nombres()).toEqual(['VISTA_PROFILE']);
    expect(texto()).not.toContain('Clientes');
  });

  it('descarta las vistas que no tienen una pantalla conocida, en lugar de mostrar un enlace roto', () => {
    mostrar([plana(vista(1, 'VISTA_QUE_NO_EXISTE', 'Pantalla fantasma')), plana(vista(2, 'VISTA_PROFILE', 'Mi perfil'))]);

    expect(nombres()).toEqual(['VISTA_PROFILE']);
    expect(texto()).not.toContain('Pantalla fantasma');
  });

  it('omite el módulo completo si ninguna de sus vistas se puede leer', () => {
    mostrar([{
      ventanaNombre: 'Administración', presentacion: 'GROUPED', orden: 1,
      vistas: [vista(1, 'VISTA_CLIENTES', 'Clientes', { leer: false }), vista(2, 'VISTA_EMPLEADOS', 'Empleados', { leer: false })]
    }]);

    expect(component.menuStructure()).toEqual([]);
    expect(texto()).not.toContain('Administración');
  });

  it('en un módulo agrupado conserva solo las vistas permitidas', () => {
    mostrar([{
      ventanaNombre: 'Administración', presentacion: 'GROUPED', orden: 1,
      vistas: [vista(1, 'VISTA_CLIENTES', 'Clientes'), vista(2, 'VISTA_EMPLEADOS', 'Empleados', { leer: false })]
    }]);

    expect(nombres()).toEqual(['VISTA_CLIENTES']);
  });

  it('ordena las entradas según el orden que define el backend', () => {
    mostrar([plana(vista(2, 'VISTA_PROFILE', 'Mi perfil'), 20), plana(vista(1, 'VISTA_CLIENTES', 'Clientes'), 10)]);

    expect(nombres()).toEqual(['VISTA_CLIENTES', 'VISTA_PROFILE']);
  });

  it('cuando cambian los permisos, las entradas retiradas desaparecen', () => {
    mostrar([plana(vista(1, 'VISTA_CLIENTES', 'Clientes')), plana(vista(2, 'VISTA_PROFILE', 'Mi perfil'))]);
    expect(texto()).toContain('Clientes');

    mostrar([plana(vista(2, 'VISTA_PROFILE', 'Mi perfil'))]);

    expect(texto()).not.toContain('Clientes');
    expect(texto()).toContain('Mi perfil');
  });

  it('un rol sin ninguna opción recibe un aviso claro y no un indicador de carga eterno', () => {
    mostrar([]);

    expect(texto()).toContain('Sin opciones disponibles');
    expect(texto()).toContain('Pide acceso al administrador');
    expect(html().querySelectorAll('p-skeleton').length).toBe(0);
  });

  it('mientras la sesión aún no se carga muestra el indicador de carga y no el aviso', () => {
    activeRoleId.set(null);
    mostrar([]);

    expect(html().querySelectorAll('p-skeleton').length).toBeGreaterThan(0);
    expect(texto()).not.toContain('Sin opciones disponibles');
  });

  it('el aviso desaparece en cuanto el rol recibe opciones', () => {
    mostrar([]);
    expect(texto()).toContain('Sin opciones disponibles');

    mostrar([plana(vista(2, 'VISTA_PROFILE', 'Mi perfil'))]);

    expect(texto()).not.toContain('Sin opciones disponibles');
  });

  it('el aviso es plano: sin sombras, transiciones ni amarillo de alerta', () => {
    mostrar([]);

    const aviso = html().querySelector('[role="status"]');
    expect(aviso?.outerHTML).not.toMatch(/shadow|transition|amber|yellow/);
  });
});
