import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ClientOnboardingComponent } from './client-onboarding.component';
import { ApoderadoService } from '../../../core/services/apoderado.service';
import { PrivacidadService } from '../../../core/services/privacidad.service';
import { RazaService } from '../../../core/services/raza.service';
import { AuthStore } from '../../../store/auth.store';

describe('ClientOnboardingComponent', () => {
  let raza: jasmine.SpyObj<RazaService>;

  beforeEach(() => {
    raza = jasmine.createSpyObj('RazaService', ['listarPorEspecie', 'crear']);
    raza.listarPorEspecie.and.returnValue(of({ data: [] } as any));

    TestBed.configureTestingModule({
      imports: [ClientOnboardingComponent],
      providers: [
        { provide: ApoderadoService, useValue: {} },
        { provide: PrivacidadService, useValue: { avisoVigente: () => of({ data: null }) } },
        { provide: RazaService, useValue: raza },
        { provide: Router, useValue: { navigate: () => Promise.resolve(true), navigateByUrl: () => Promise.resolve(true) } },
        {
          provide: AuthStore,
          useValue: {
            selectedEnterprise: () => ({ establishmentId: 7 }),
            companyId: () => 7,
            hasAccess: () => true
          }
        }
      ]
    });
  });

  function crear() {
    const fixture = TestBed.createComponent(ClientOnboardingComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  function escribirPeso(component: ClientOnboardingComponent, texto: string) {
    const input = document.createElement('input');
    input.value = texto;
    component.sanitizePeso({ target: input } as unknown as Event);
    return input.value;
  }

  it('recorta el peso a 3 enteros y 2 decimales aunque se pegue un número enorme', () => {
    const component = crear();
    component.petForm.controls.especie.setValue('PERRO');

    expect(escribirPeso(component, '144444444444444444444')).toBe('144');
    expect(escribirPeso(component, '12,5678')).toBe('12.56');
    expect(escribirPeso(component, '1e+5abc')).toBe('15');
  });

  it('valida el peso contra el rango de la especie y muestra el motivo', () => {
    const component = crear();
    component.petForm.controls.especie.setValue('GATO');

    component.petForm.controls.peso.setValue('25');
    expect(component.petForm.controls.peso.errors?.['pesoRango']).toEqual({ min: 0.3, max: 20 });
    expect(component.petError('peso')).toContain('entre 0.3 y 20 kg');

    component.petForm.controls.peso.setValue('4.5');
    expect(component.petForm.controls.peso.valid).toBeTrue();

    component.petForm.controls.especie.setValue('PERRO');
    component.petForm.controls.peso.setValue('0.2');
    expect(component.petForm.controls.peso.errors?.['pesoRango']).toEqual({ min: 0.5, max: 120 });
  });

  it('acepta el peso vacío porque es opcional', () => {
    const component = crear();
    component.petForm.controls.especie.setValue('PERRO');
    component.petForm.controls.peso.setValue('');
    expect(component.petForm.controls.peso.valid).toBeTrue();
  });

  it('crea una raza para la especie elegida y la deja seleccionada', () => {
    const component = crear();
    component.petForm.controls.especie.setValue('PERRO');
    raza.crear.and.returnValue(of({ data: { id: 55, nombre: 'Shitzu', activo: true } } as any));

    component.openBreedModal();
    expect(component.breedModalOpen()).toBeTrue();
    component.breedForm.setValue({ nombre: 'Shitzu', descripcion: '' });
    component.saveBreed();

    expect(raza.crear).toHaveBeenCalledWith({ nombre: 'Shitzu', descripcion: undefined, especie: 'PERRO' }, 7);
    expect(component.petForm.controls.razaId.value).toBe(55);
    expect(component.breeds()[0]).toEqual({ label: 'Shitzu', value: 55 });
    expect(component.breedModalOpen()).toBeFalse();
  });

  it('no abre el formulario de raza sin especie y conserva el modal si la creación falla', () => {
    const component = crear();
    component.openBreedModal();
    expect(component.breedModalOpen()).toBeFalse();

    component.petForm.controls.especie.setValue('GATO');
    raza.crear.and.returnValue(throwError(() => ({ error: { message: 'La raza ya existe' } })));
    component.openBreedModal();
    component.breedForm.setValue({ nombre: 'Persa', descripcion: '' });
    component.saveBreed();

    expect(component.breedModalOpen()).toBeTrue();
    expect(component.breedError()).toBe('La raza ya existe');
  });

  it('rechaza nombres de raza con números o símbolos', () => {
    const component = crear();
    component.breedForm.setValue({ nombre: 'Perro 123', descripcion: '' });
    expect(component.breedFieldError('nombre')).toContain('sin números ni símbolos');
  });
});
