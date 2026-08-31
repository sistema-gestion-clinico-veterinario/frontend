import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HasPermissionDirective } from './has-permission.directive';
import { AuthStore } from '../../store/auth.store';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MenuItemDTO } from '../../models/response/auth-login-response.model';

@Component({
  standalone: true,
  imports: [HasPermissionDirective],
  template: `<ng-container *appHasPermission="permission"><span id="content">VISIBLE</span></ng-container>`,
})
class HostComponent {
  permission = '';
}

describe('HasPermissionDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let store: InstanceType<typeof AuthStore>;

  const baseAuth = {
    token: null as null, refreshToken: null as null,
    roles: [] as string[], menu: [] as any[],
    passwordChanged: false, needsCompanySelection: false,
  };

  function flatItem(codigo: string): MenuItemDTO {
    return { id: 1, codigo, nombre: codigo, activo: true, leer: true, escribir: false, modificar: false, eliminar: false } as MenuItemDTO;
  }

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [HostComponent, HttpClientTestingModule],
    }).compileComponents();

    store = TestBed.inject(AuthStore);
    store.logout();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
  });

  it('renders content when permission is empty (no restriction)', () => {
    host.permission = '';
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#content')).not.toBeNull();
  });

  it('does not bypass view permissions for a platform administrator', () => {
    store.setAuth({ ...baseAuth, activeRolePurpose: 'PLATFORM_ADMIN' });
    host.permission = 'VISTA_MASCOTAS';
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#content')).toBeNull();
  });

  it('renders content when user has the required access in the menu', () => {
    store.setAuth({ ...baseAuth, roles: ['ROLE_EMPLEADO'], menu: [flatItem('VISTA_MASCOTAS')] });
    host.permission = 'VISTA_MASCOTAS:leer';
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#content')).not.toBeNull();
  });

  it('[BB-003] hides content when user does not have access to the ventana', () => {
    store.setAuth({ ...baseAuth, roles: ['ROLE_EMPLEADO'], menu: [] });
    host.permission = 'VISTA_MASCOTAS';
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#content')).toBeNull();
  });
});
