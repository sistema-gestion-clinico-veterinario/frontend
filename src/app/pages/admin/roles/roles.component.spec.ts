import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RolesComponent } from './roles.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MessageService } from 'primeng/api';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

describe('RolesComponent', () => {
  let component: RolesComponent;
  let fixture: ComponentFixture<RolesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RolesComponent, HttpClientTestingModule],
      providers: [MessageService, provideRouter([])]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RolesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('permisos de los roles base', () => {
    const rol = (cambios: Record<string, unknown>) => ({
      id: 1, name: 'ROLE_ADMIN', activo: true, companyId: null, scope: 'STAFF',
      purpose: 'COMPANY_ADMIN', systemManaged: true, protectedRole: true,
      permissionVersion: 0, ambitoEditable: false, ...cambios
    }) as any;

    function conSesion(superAdmin: boolean, modificar: boolean) {
      (component as any).isSuperAdmin = () => superAdmin;
      (component as any).hasModifyAccess = () => modificar;
    }

    it('la plataforma configura los permisos de un rol base', () => {
      conSesion(true, true);
      expect(component.canConfigureRole(rol({}))).toBeTrue();
      expect(component.editsBaseRoleForAllCompanies(rol({}))).toBeTrue();
    });

    it('la plataforma no configura su propio rol de administración', () => {
      conSesion(true, true);
      expect(component.canConfigureRole(rol({ purpose: 'PLATFORM_ADMIN' }))).toBeFalse();
    });

    it('el personal de la clínica no configura un rol base', () => {
      conSesion(false, true);
      expect(component.canConfigureRole(rol({}))).toBeFalse();
    });

    it('sin permiso de modificar roles nadie configura nada', () => {
      conSesion(true, false);
      expect(component.canConfigureRole(rol({}))).toBeFalse();
    });

    it('un rol base inactivo no se configura', () => {
      conSesion(true, true);
      expect(component.canConfigureRole(rol({ activo: false }))).toBeFalse();
    });

    it('renombrar, desactivar y eliminar siguen bloqueados en un rol base', () => {
      conSesion(true, true);
      expect(component.canRenameRole(rol({}))).toBeFalse();
      expect(component.canToggleRole(rol({}))).toBeFalse();
    });
  });

  describe('duplicación de roles de empresa', () => {
    const role = (changes: Record<string, unknown> = {}) => ({
      id: 10, name: 'ROLE_VETERINARIO', descripcion: 'Atención clínica', activo: true,
      companyId: 7, scope: 'STAFF', purpose: 'CUSTOM', systemManaged: false,
      protectedRole: false, permissionVersion: 0, ambitoEditable: true, ...changes
    }) as any;

    beforeEach(() => {
      spyOn((component as any).authStore, 'hasAccess').and.returnValue(true);
    });

    it('solo permite duplicar roles pertenecientes a una empresa', () => {
      expect(component.canDuplicateRole(role())).toBeTrue();
      expect(component.canDuplicateRole(role({ companyId: null }))).toBeFalse();
    });

    it('sugiere un nombre comprensible y evita repetir uno existente', () => {
      component.companyRoles.set([
        role(),
        role({ id: 11, name: 'ROLE_VETERINARIO_PERSONALIZADO' })
      ]);

      component.openDuplicateModal(role());

      expect(component.showDuplicateModal()).toBeTrue();
      expect(component.duplicateRoleName()).toBe('VETERINARIO PERSONALIZADO A');
      expect(component.duplicateRoleDesc()).toBe('Atención clínica');
    });

    it('crea el duplicado, lo incorpora a la lista y lo selecciona', () => {
      const source = role();
      const duplicate = role({ id: 12, name: 'ROLE_VETERINARIO_ENCARGADO' });
      component.companyRoles.set([source]);
      component.openDuplicateModal(source);
      component.duplicateRoleName.set('Veterinario encargado');
      spyOn((component as any).roleService, 'duplicar').and.returnValue(of({ data: duplicate }));
      const selectSpy = spyOn(component, 'selectRole');

      component.duplicateRole();

      expect((component as any).roleService.duplicar).toHaveBeenCalledWith(10, {
        name: 'ROLE_VETERINARIO_ENCARGADO',
        descripcion: 'Atención clínica'
      });
      expect(component.companyRoles()).toContain(duplicate);
      expect(selectSpy).toHaveBeenCalledWith(duplicate);
      expect(component.showDuplicateModal()).toBeFalse();
    });
  });
});
