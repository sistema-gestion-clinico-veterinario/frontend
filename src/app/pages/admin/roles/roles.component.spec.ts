import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RolesComponent } from './roles.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MessageService } from 'primeng/api';
import { provideRouter } from '@angular/router';

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
});
