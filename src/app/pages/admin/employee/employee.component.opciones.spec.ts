import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EmployeeComponent } from './employee.component';

describe('EmployeeComponent — listas filtradas del formulario', () => {
  let component: EmployeeComponent;
  let fixture: ComponentFixture<EmployeeComponent>;

  const roles = [
    { label: 'Veterinario', value: 1, purpose: 'CUSTOM' },
    { label: 'Asistente', value: 2, purpose: 'CUSTOM' },
    { label: 'Supervisor de caja', value: 3, purpose: 'CUSTOM' }
  ] as any;
  const tipos = [{ label: 'Médico veterinario' }, { label: 'Auxiliar' }];
  const especialidades = [{ label: 'Cirugía veterinaria' }, { label: 'Diagnóstico por imágenes' }];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmployeeComponent, HttpClientTestingModule],
      providers: [provideRouter([])]
    })
      .overrideComponent(EmployeeComponent, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(EmployeeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    component.roles.set(roles);
    component.tiposEmpleadoList.set(tipos);
    component.especialidadesList.set(especialidades);
    component.searchFilter.set('');
  });

  it('sin texto de búsqueda devuelve cada lista completa, tal cual', () => {
    expect(component.rolesFiltrados()).toBe(roles);
    expect(component.tiposEmpleadoFiltrados()).toBe(tipos);
    expect(component.especialidadesFiltradas()).toBe(especialidades);
  });

  it('con texto filtra por la etiqueta sin distinguir mayúsculas', () => {
    component.searchFilter.set('VETERINAR');

    expect(component.rolesFiltrados().map(r => r.label)).toEqual(['Veterinario']);
    expect(component.tiposEmpleadoFiltrados().map(t => t.label)).toEqual(['Médico veterinario']);
    expect(component.especialidadesFiltradas().map(e => e.label)).toEqual(['Cirugía veterinaria']);
  });

  it('un texto que no coincide deja las listas vacías', () => {
    component.searchFilter.set('zzz');

    expect(component.rolesFiltrados()).toEqual([]);
    expect(component.tiposEmpleadoFiltrados()).toEqual([]);
    expect(component.especialidadesFiltradas()).toEqual([]);
  });

  it('al borrar el texto vuelven las listas completas', () => {
    component.searchFilter.set('zzz');
    expect(component.rolesFiltrados()).toEqual([]);

    component.searchFilter.set('');

    expect(component.rolesFiltrados()).toBe(roles);
  });

  it('si cambia la lista de origen, el resultado se actualiza', () => {
    component.searchFilter.set('as');
    expect(component.rolesFiltrados().map(r => r.label)).toEqual(['Asistente']);

    component.roles.set([...roles, { label: 'Asesor', value: 4, purpose: 'CUSTOM' } as any]);

    expect(component.rolesFiltrados().map(r => r.label)).toEqual(['Asistente', 'Asesor']);
  });
});
