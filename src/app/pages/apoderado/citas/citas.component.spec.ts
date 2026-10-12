import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CitasComponent } from './citas.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

describe('CitasComponent', () => {
  let component: CitasComponent;
  let fixture: ComponentFixture<CitasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CitasComponent, HttpClientTestingModule],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => null }, queryParamMap: { get: () => null } }, params: of({}), queryParams: of({}), queryParamMap: of({ get: () => null }) } },
      ],
    })
    .overrideComponent(CitasComponent, { set: { template: '' } })
    .compileComponents();

    fixture = TestBed.createComponent(CitasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('cancelar una cita', () => {
    const citaEnDosDias = () => ({
      estado: 'CONFIRMADA',
      fechaHoraInicio: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19),
    });
    const conPermisos = (permitidas: string[]) =>
      spyOn((component as any).authStore, 'hasAccess').and.callFake(
        (vista: string, accion: string) => vista === 'VISTA_MIS_CITAS' && permitidas.includes(accion));

    it('se permite con el permiso de modificar', () => {
      conPermisos(['modificar']);

      expect(component.canCancel(citaEnDosDias())).toBeTrue();
    });

    it('no depende del permiso de eliminar', () => {
      conPermisos(['eliminar']);

      expect(component.canCancel(citaEnDosDias())).toBeFalse();
    });
  });
});
