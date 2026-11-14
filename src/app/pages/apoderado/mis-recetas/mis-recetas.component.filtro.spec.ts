import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MisRecetasComponent } from './mis-recetas.component';

const receta = (id: number, extra: Record<string, unknown>): any => ({
  id, pacienteNombre: null, numeroHc: null, medicamento: null, principioActivo: null, veterinarioNombre: null, ...extra
});

describe('MisRecetasComponent — búsqueda de recetas', () => {
  let component: MisRecetasComponent;
  let fixture: ComponentFixture<MisRecetasComponent>;

  const recetas = [
    receta(1, { pacienteNombre: 'Luna', medicamento: 'Amoxicilina', veterinarioNombre: 'Dra. Pérez' }),
    receta(2, { pacienteNombre: 'Toby', numeroHc: 'HC-000101', principioActivo: 'Meloxicam' }),
    receta(3, { pacienteNombre: 'Nala', medicamento: 'Omeprazol' })
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MisRecetasComponent, HttpClientTestingModule]
    })
      .overrideComponent(MisRecetasComponent, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(MisRecetasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    component.recetas.set(recetas);
    component.searchQuery.set('');
  });

  it('sin texto devuelve todas las recetas', () => {
    expect(component.recetasFiltradas()).toBe(recetas);
  });

  it('busca en el paciente, la historia, el medicamento, el principio activo y el veterinario', () => {
    const ids = (texto: string) => {
      component.searchQuery.set(texto);
      return component.recetasFiltradas().map(r => r.id);
    };

    expect(ids('luna')).toEqual([1]);
    expect(ids('hc-0001')).toEqual([2]);
    expect(ids('omeprazol')).toEqual([3]);
    expect(ids('meloxi')).toEqual([2]);
    expect(ids('pérez')).toEqual([1]);
  });

  it('ignora espacios alrededor y mayúsculas', () => {
    component.searchQuery.set('  AMOXI  ');

    expect(component.recetasFiltradas().map(r => r.id)).toEqual([1]);
  });

  it('un texto sin coincidencias deja la lista vacía', () => {
    component.searchQuery.set('xyz');

    expect(component.recetasFiltradas()).toEqual([]);
  });

  it('las lecturas repetidas devuelven la misma lista, sin volver a filtrar', () => {
    component.searchQuery.set('a');

    expect(component.recetasFiltradas()).toBe(component.recetasFiltradas());
  });

  it('si llegan recetas nuevas, el resultado se actualiza', () => {
    component.searchQuery.set('toby');
    expect(component.recetasFiltradas().length).toBe(1);

    component.recetas.set([...recetas, receta(4, { pacienteNombre: 'Toby II' })]);

    expect(component.recetasFiltradas().map(r => r.id)).toEqual([2, 4]);
  });
});
