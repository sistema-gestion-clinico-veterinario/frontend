import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { MascotaFormComponent } from './mascota-form.component';

describe('MascotaFormComponent — búsqueda de raza', () => {
  let component: MascotaFormComponent;
  let fixture: ComponentFixture<MascotaFormComponent>;

  const razas = [
    { label: 'Labrador Retriever', value: 1 },
    { label: 'Golden Retriever', value: 2 },
    { label: 'Beagle', value: 3 }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MascotaFormComponent, HttpClientTestingModule],
      providers: [
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate', 'navigateByUrl', 'getCurrentNavigation']) },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => null }, queryParamMap: { get: () => null } }, params: of({}), queryParams: of({}) } }
      ]
    })
      .overrideComponent(MascotaFormComponent, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(MascotaFormComponent);
    component = fixture.componentInstance;
    component.razas.set(razas);
    component.razaFilterText.set('');
  });

  it('sin texto devuelve todas las razas', () => {
    expect(component.razasFiltradas().map(r => r.value)).toEqual([1, 2, 3]);
  });

  it('con texto filtra por la etiqueta sin distinguir mayúsculas', () => {
    component.razaFilterText.set('RETRIEVER');

    expect(component.razasFiltradas().map(r => r.value)).toEqual([1, 2]);
  });

  it('un texto sin coincidencias deja la lista vacía', () => {
    component.razaFilterText.set('zzz');

    expect(component.razasFiltradas()).toEqual([]);
  });

  it('las lecturas repetidas devuelven la misma lista, sin volver a filtrar', () => {
    component.razaFilterText.set('retr');

    expect(component.razasFiltradas()).toBe(component.razasFiltradas());
  });

  it('si cambia el catálogo de razas, el resultado se actualiza', () => {
    component.razaFilterText.set('bea');
    expect(component.razasFiltradas().length).toBe(1);

    component.razas.set([...razas, { label: 'Beagle enano', value: 4 }]);

    expect(component.razasFiltradas().map(r => r.value)).toEqual([3, 4]);
  });
});
