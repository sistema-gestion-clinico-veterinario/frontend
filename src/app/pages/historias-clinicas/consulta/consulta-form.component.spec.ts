import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConsultaFormComponent } from './consulta-form.component';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService, ConfirmationService } from 'primeng/api';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { AuthStore } from '../../../store/auth.store';
import { of } from 'rxjs';
import { MenuItemDTO } from '../../../models/response/auth-login-response.model';

describe('ConsultaFormComponent – permission computed signals', () => {
  let component: ConsultaFormComponent;
  let fixture: ComponentFixture<ConsultaFormComponent>;
  let store: InstanceType<typeof AuthStore>;

  function makeHistoriasItem(overrides: Partial<MenuItemDTO> = {}): MenuItemDTO {
    return {
      id: 1, codigo: 'VISTA_HISTORIAS', nombre: 'Historias', activo: true,
      leer: true, escribir: true, modificar: true, eliminar: true,
      ruta: '/historias-clinicas', ...overrides,
    } as MenuItemDTO;
  }

  const baseAuth = {
    token: null as null, refreshToken: null as null,
    roles: [] as string[], menu: [] as any[],
    passwordChanged: false, needsCompanySelection: false,
  };

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [ConsultaFormComponent, HttpClientTestingModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: () => '1' } },
            params: of({ id: '1' }),
            queryParams: of({}),
          },
        },
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate', 'navigateByUrl']) },
        { provide: MessageService, useValue: { add: jasmine.createSpy('add') } },
        { provide: ConfirmationService, useValue: { confirm: jasmine.createSpy('confirm') } },
      ],
    })
      .overrideComponent(ConsultaFormComponent, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(ConsultaFormComponent);
    component = fixture.componentInstance;
    store = TestBed.inject(AuthStore);
    store.logout();
  });

  it('canCreateReceta is true when user has write access and consulta is open', () => {
    store.setAuth({ ...baseAuth, roles: ['ROLE_EMPLEADO'], menu: [makeHistoriasItem()] });
    component.isCerrada.set(false);
    expect(component.canCreateReceta()).toBeTrue();
  });

  it('canCreateReceta is false when user has no write access', () => {
    store.setAuth({ ...baseAuth, roles: ['ROLE_EMPLEADO'], menu: [] });
    component.isCerrada.set(false);
    expect(component.canCreateReceta()).toBeFalse();
  });

  it('canModifyReceta is true for admin with modify access even when consulta is closed', () => {
    store.setAuth({ ...baseAuth, roles: ['ROLE_ADMIN'], menu: [makeHistoriasItem()] });
    component.isCerrada.set(true);
    expect(component.canModifyReceta()).toBeTrue();
  });

  it('canDeleteReceta is true when user has delete access and consulta is open', () => {
    store.setAuth({ ...baseAuth, roles: ['ROLE_EMPLEADO'], menu: [makeHistoriasItem()] });
    component.isCerrada.set(false);
    expect(component.canDeleteReceta()).toBeTrue();
  });
});
