import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { provideRouter, RouterOutlet } from '@angular/router';
import { MainLayoutComponent } from './main-layout.component';
import { ChangePasswordModalComponent } from './change-password-modal/change-password-modal.component';
import { AuthStore } from '../../store/auth.store';

@Component({ selector: 'app-sidebar', standalone: true, template: '' })
class SidebarStub {
  @Input() collapsed = false;
  @Output() toggleSidebar = new EventEmitter<void>();
  @Output() navigate = new EventEmitter<void>();
}

@Component({ selector: 'app-navbar', standalone: true, template: '' })
class NavbarStub {
  @Output() toggleSidebar = new EventEmitter<void>();
}

const DISMISSED_KEY = 'pw_modal_dismissed';

describe('MainLayoutComponent — aviso para cambiar la contraseña', () => {
  let fixture: ComponentFixture<MainLayoutComponent>;
  let store: InstanceType<typeof AuthStore>;

  function crear(passwordChanged: boolean): void {
    TestBed.configureTestingModule({
      imports: [MainLayoutComponent, HttpClientTestingModule],
      providers: [provideRouter([])]
    }).overrideComponent(MainLayoutComponent, {
      set: { imports: [RouterOutlet, SidebarStub, NavbarStub, ChangePasswordModalComponent] }
    });
    store = TestBed.inject(AuthStore);
    store.logout();
    store.setAuth({
      token: null,
      refreshToken: null,
      roles: [],
      menu: [],
      passwordChanged,
      needsCompanySelection: false
    });
    fixture = TestBed.createComponent(MainLayoutComponent);
    fixture.detectChanges();
  }

  const modal = () => fixture.nativeElement.querySelector('app-change-password-modal');

  beforeEach(() => sessionStorage.removeItem(DISMISSED_KEY));
  afterEach(() => sessionStorage.removeItem(DISMISSED_KEY));

  it('aparece en cualquier pantalla del layout cuando la contraseña no se ha cambiado', () => {
    crear(false);
    expect(modal()).not.toBeNull();
  });

  it('no aparece cuando la contraseña ya se cambió', () => {
    crear(true);
    expect(modal()).toBeNull();
  });

  it('no vuelve a aparecer en la sesión del navegador una vez cerrado', () => {
    crear(false);
    fixture.componentInstance.dismissPasswordModal();
    fixture.detectChanges();

    expect(modal()).toBeNull();
    expect(sessionStorage.getItem(DISMISSED_KEY)).toBe('1');
  });

  it('respeta que ya se haya cerrado antes en esta sesión', () => {
    sessionStorage.setItem(DISMISSED_KEY, '1');
    crear(false);
    expect(modal()).toBeNull();
  });
});
