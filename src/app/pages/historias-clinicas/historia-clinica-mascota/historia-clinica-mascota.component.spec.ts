import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HistoriaClinicaMascotaComponent } from './historia-clinica-mascota.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';

describe('HistoriaClinicaMascotaComponent', () => {
  let component: HistoriaClinicaMascotaComponent;
  let fixture: ComponentFixture<HistoriaClinicaMascotaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistoriaClinicaMascotaComponent, HttpClientTestingModule],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => null }, queryParamMap: { get: () => null } }, params: of({}), queryParams: of({}), queryParamMap: of({ get: () => null }) } },
      ],
    })
    .overrideComponent(HistoriaClinicaMascotaComponent, { set: { template: '' } })
    .compileComponents();

    fixture = TestBed.createComponent(HistoriaClinicaMascotaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('reúne las recetas de todas las consultas de la mascota, de la más reciente a la más antigua', () => {
    const receta = (id: number, medicamento: string, fechaInicio: string) =>
      ({ id, medicamento, dosis: '1', frecuencia: 'c/12h', fechaInicio });
    component.hc.set({
      consultas: [
        { id: 1, motivoConsulta: 'Control', prescripciones: [receta(1, 'Amoxicilina', '2026-08-01')] },
        { id: 2, motivoConsulta: 'Dermatitis', prescripciones: [receta(2, 'Prednisona', '2026-09-15'), receta(3, 'Cetirizina', '2026-09-15')] },
        { id: 3, motivoConsulta: 'Revisión', prescripciones: [] }
      ]
    } as any);

    expect(component.recetasMascota().map(item => item.receta.medicamento))
      .toEqual(['Cetirizina', 'Prednisona', 'Amoxicilina']);
    expect(component.recetasMascota()[0].consulta.id).toBe(2);
  });

  it('no devuelve recetas cuando la mascota no tiene historia cargada', () => {
    expect(component.recetasMascota()).toEqual([]);
  });

  it('marca una receta como vigente solo si su fecha de fin no pasó', () => {
    expect(component.recetaVigente(undefined)).toBeFalse();
    expect(component.recetaVigente('2000-01-01')).toBeFalse();
    expect(component.recetaVigente('2999-01-01')).toBeTrue();
  });

  describe('cuando la historia no se puede abrir', () => {
    function fallar(status: number) {
      spyOn((component as any).hcService, 'getPorNumeroHc').and.returnValue(throwError(() => ({ status })));
      component.cargarHistoria('HC-000001');
    }

    it('una historia que no existe o es de otra clínica se muestra como no encontrada', () => {
      fallar(404);
      expect(component.errorCarga()).toBe('NO_ENCONTRADO');
      expect(component.hc()).toBeNull();
    });

    it('una historia de la clínica que el rol no puede ver se muestra como sin acceso', () => {
      fallar(403);
      expect(component.errorCarga()).toBe('SIN_PERMISO');
    });

    it('un fallo del servidor ofrece reintentar y se limpia al cargar de nuevo', () => {
      fallar(500);
      expect(component.errorCarga()).toBe('FALLO');
      component.cargarHistoria('HC-000001');
      expect(component.errorCarga()).toBe('FALLO');
      (component as any).hcService.getPorNumeroHc.and.returnValue(of({ data: { consultas: [], mascotaId: 1 } }));
      component.cargarHistoria('HC-000001');
      expect(component.errorCarga()).toBeNull();
    });
  });
});
