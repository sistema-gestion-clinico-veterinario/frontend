import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { CartillaComponent } from './cartilla.component';
import { CartillaService } from '../../core/services/cartilla.service';
import { ControlPreventivoService } from '../../core/services/control-preventivo.service';
import { MascotaService } from '../../core/services/mascota.service';
import { ServicioService } from '../../core/services/servicio.service';
import { AuthStore } from '../../store/auth.store';

describe('CartillaComponent', () => {
  let registrar: Subject<any>;
  let cartilla: jasmine.SpyObj<CartillaService>;

  beforeEach(() => {
    registrar = new Subject<any>();
    cartilla = jasmine.createSpyObj('CartillaService', ['registrarVacunacion', 'registrarDesparasitacion']);
    cartilla.registrarVacunacion.and.returnValue(registrar.asObservable() as any);

    TestBed.configureTestingModule({
      imports: [CartillaComponent],
      providers: [
        { provide: CartillaService, useValue: cartilla },
        { provide: ControlPreventivoService, useValue: {} },
        { provide: MascotaService, useValue: {} },
        { provide: ServicioService, useValue: {} },
        { provide: AuthStore, useValue: {} },
        { provide: Router, useValue: { navigate: () => Promise.resolve(true) } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } }
      ]
    });
  });

  function prepararAplicacion() {
    const fixture = TestBed.createComponent(CartillaComponent);
    const component = fixture.componentInstance;
    component.mascotaSel.set({ id: 20 } as any);
    component.tipoVacunaId = 50;
    component.fechaAplicacion = '2026-10-19';
    component.servicioId = 40;
    return component;
  }

  it('envía una sola solicitud aunque se confirme dos veces seguidas', () => {
    const component = prepararAplicacion();

    component.guardar();
    component.guardar();

    expect(cartilla.registrarVacunacion).toHaveBeenCalledTimes(1);
    expect(component.guardando()).toBeTrue();
  });

  it('libera el botón cuando el registro falla para poder reintentar', () => {
    const component = prepararAplicacion();

    component.guardar();
    registrar.error({ error: { message: 'Ya existe un registro' } });

    expect(component.guardando()).toBeFalse();
  });
});
