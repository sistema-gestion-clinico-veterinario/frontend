import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { HorarioEmpleadoResponse } from '../../models/response/horario-empleado-response';
import { ProfileResponse } from '../../models/response/profile-response';
import { ProfileComponent } from './profile.component';

const horario = (id: number, diaSemana: string, horaInicio: string, horaFin: string, fecha: string | null = null): HorarioEmpleadoResponse =>
  ({ id, diaSemana, horaInicio, horaFin, fecha: fecha as string, activo: true });

const perfil = (horarios: HorarioEmpleadoResponse[]): ProfileResponse => ({
  id: 1, email: 'ana@clinica.pe', nombre: 'Ana', apellido: 'Prueba', dni: '12345678', telefono: '999999999',
  direccion: 'Calle 1', roles: ['EMPLEADO'], companyName: 'Clínica', activo: true, empleadoId: 7, genero: null,
  tipoDocumento: null, numeroColegiatura: null, observaciones: null, fotoUrl: null, especialidades: [],
  tiposEmpleado: [], horarios, empleado: true
});

const LUNES = new Date(2026, 10, 16, 10, 0, 0);
const MARTES = new Date(2026, 10, 17, 10, 0, 0);

describe('ProfileComponent — horario de trabajo', () => {
  let fixture: ComponentFixture<ProfileComponent>;
  let component: ProfileComponent;

  const horarios = [
    horario(1, 'LUNES', '08:00:00', '12:00:00'),
    horario(2, 'LUNES', '14:00:00', '18:00:00'),
    horario(3, 'MARTES', '09:00:00', '13:00:00'),
    horario(4, 'VIERNES', '08:00:00', '12:00:00', '2026-11-20'),
    horario(5, 'JUEVES', '08:00:00', '12:00:00', '2026-12-31')
  ];

  async function crear(fecha: Date): Promise<void> {
    jasmine.clock().install();
    jasmine.clock().mockDate(fecha);
    await TestBed.configureTestingModule({
      imports: [ProfileComponent, HttpClientTestingModule],
      providers: [provideRouter([]), provideNoopAnimations()]
    }).compileComponents();
    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    component.profile.set(perfil(horarios));
  }

  function dibujar(): void {
    fixture.detectChanges();
    component.profile.set(perfil(horarios));
    component.cargando.set(false);
    component.mostrarHorario.set(true);
  }

  const filasDelHorario = () => Array.from(document.body.querySelectorAll('article')) as HTMLElement[];

  afterEach(() => jasmine.clock().uninstall());

  it('la plantilla se dibuja sin que cambien valores entre la revisión y su verificación', async () => {
    await crear(LUNES);
    dibujar();

    expect(() => fixture.detectChanges()).not.toThrow();
  });

  it('los días de la semana no se vuelven a crear en cada revisión', async () => {
    await crear(LUNES);
    dibujar();
    fixture.detectChanges();
    const antes = filasDelHorario();

    fixture.detectChanges();
    fixture.detectChanges();
    const despues = filasDelHorario();

    expect(antes.length).toBe(7);
    expect(despues.length).toBe(7);
    antes.forEach((fila, i) => expect(despues[i]).toBe(fila));
  });

  it('la semana completa tiene los siete días en orden, con sus bloques', async () => {
    await crear(LUNES);

    const semana = component.semanaCompleta();

    expect(semana.map(d => d.diaSemana)).toEqual(['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO']);
    expect(semana[0].label).toBe('Lunes');
    expect(semana[0].bloques.map(b => b.horaInicio + '-' + b.horaFin)).toEqual(['08:00-12:00', '14:00-18:00']);
    expect(semana[2].bloques).toEqual([]);
  });

  it('solo cuenta los horarios con fecha que caen en la semana actual', async () => {
    await crear(LUNES);

    const resumen = component.horariosResumen();

    expect(resumen.some(h => h.diaSemana === 'VIERNES')).toBeTrue();
    expect(resumen.some(h => h.diaSemana === 'JUEVES')).toBeFalse();
  });

  it('el turno de hoy corresponde al día actual', async () => {
    await crear(LUNES);

    expect(component.turnosHoy()).toEqual(['08:00 – 12:00', '14:00 – 18:00']);
    expect(component.diaDeHoy().label).toBe('Lunes');
  });

  it('la parrilla cubre desde la primera hora hasta la última', async () => {
    await crear(LUNES);

    const parrilla = component.gridHorario();

    expect(parrilla[0].hora).toBe('08:00 – 09:00');
    expect(parrilla[parrilla.length - 1].hora).toBe('17:00 – 18:00');
    expect(parrilla[0].dias[0]).toBeTrue();
    expect(parrilla[0].dias[1]).toBeFalse();
  });

  it('al volver a la pestaña al día siguiente, el turno de hoy se actualiza', async () => {
    await crear(LUNES);
    expect(component.turnosHoy()).toEqual(['08:00 – 12:00', '14:00 – 18:00']);

    jasmine.clock().mockDate(MARTES);
    document.dispatchEvent(new Event('visibilitychange'));

    expect(component.turnosHoy()).toEqual(['09:00 – 13:00']);
    expect(component.diaDeHoy().label).toBe('Martes');
  });

  it('sin horarios, los cálculos devuelven resultados vacíos', async () => {
    await crear(LUNES);
    component.profile.set(perfil([]));

    expect(component.horariosResumen()).toEqual([]);
    expect(component.turnosHoy()).toEqual([]);
    expect(component.gridHorario()).toEqual([]);
    expect(component.semanaCompleta().every(d => d.bloques.length === 0)).toBeTrue();
  });
});
