import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';
import { ConsentimientosVeterinariosComponent } from './consentimientos-veterinarios.component';
import { ConsentimientoVeterinarioService } from '../../../core/services/consentimiento-veterinario.service';
import { ConsentimientoVeterinario } from '../../../models/privacy/consentimiento-veterinario.model';

describe('ConsentimientosVeterinariosComponent', () => {
  let fixture: ComponentFixture<ConsentimientosVeterinariosComponent>;
  let component: ConsentimientosVeterinariosComponent;
  let servicio: jasmine.SpyObj<ConsentimientoVeterinarioService>;

  const respuesta = <T>(data: T) => of({ success: true, message: 'ok', data });
  const html = () => fixture.nativeElement as HTMLElement;
  const texto = () => html().textContent?.replace(/\s+/g, ' ') ?? '';

  const documento = (parcial: Partial<ConsentimientoVeterinario> = {}): ConsentimientoVeterinario => ({
    uuid: 'u-1', mascotaId: 4, mascota: 'Luna', consultaId: null, apoderadoId: 9, titular: 'Ana Torres',
    procedimiento: 'Esterilización', diagnosticoIndicacion: 'd', descripcionProcedimiento: 'p', beneficiosEsperados: 'b',
    riesgosPrevisibles: 'r', alternativas: 'a', consecuenciasNoRealizar: 'c', autorizacionAnestesia: true,
    autorizacionEmergencia: false, version: 1, contenido: 'CONSENTIMIENTO INFORMADO', contenidoHash: 'abc123',
    estado: 'PENDIENTE', creadoAt: '2026-10-13T10:00:00', decididoAt: null, nombreFirmante: null, documentoFirmante: null,
    relacionFirmante: null, preguntasAclaradas: false, motivoRechazo: null, revocadoAt: null, motivoRevocacion: null,
    ...parcial
  });

  const llenarFormulario = () =>
    component.form.patchValue({
      mascotaId: 4, apoderadoId: 9, consultaId: null, procedimiento: '  Esterilización  ',
      diagnosticoIndicacion: 'Indicación', descripcionProcedimiento: 'Descripción', beneficiosEsperados: 'Beneficios',
      riesgosPrevisibles: 'Riesgos', alternativas: 'Alternativas', consecuenciasNoRealizar: 'Consecuencias',
      autorizacionAnestesia: true
    });

  function crear(lista: ConsentimientoVeterinario[] = []): void {
    servicio = jasmine.createSpyObj<ConsentimientoVeterinarioService>('ConsentimientoVeterinarioService', ['listar', 'crear']);
    servicio.listar.and.returnValue(respuesta(lista));
    servicio.crear.and.returnValue(respuesta(documento()));

    TestBed.configureTestingModule({
      imports: [ConsentimientosVeterinariosComponent],
      providers: [provideRouter([]), { provide: ConsentimientoVeterinarioService, useValue: servicio }]
    });
    fixture = TestBed.createComponent(ConsentimientosVeterinariosComponent);
    component = fixture.componentInstance;
    fixture.debugElement.injector.get(MessageService);
    fixture.detectChanges();
  }

  it('carga y muestra los documentos emitidos con su estado en español', () => {
    crear([documento(), documento({ uuid: 'u-2', estado: 'ACEPTADO', mascota: 'Nube' })]);

    expect(servicio.listar).toHaveBeenCalledTimes(1);
    expect(texto()).toContain('Luna · Esterilización');
    expect(texto()).toContain('Pendiente de decisión');
    expect(texto()).toContain('Aceptado');
    expect(texto()).toContain('SHA-256: abc123');
  });

  it('avisa cuando todavía no hay documentos', () => {
    crear([]);
    expect(texto()).toContain('No hay documentos emitidos.');
  });

  it('si no se pueden cargar, muestra el motivo y permite reintentar', () => {
    crear();
    servicio.listar.and.returnValue(throwError(() => ({ error: { message: 'Sin acceso a consentimientos' } })));

    component.cargar();
    fixture.detectChanges();

    expect(texto()).toContain('Sin acceso a consentimientos');
    expect(texto()).toContain('Reintentar');
    expect(component.cargando()).toBeFalse();
  });

  it('no envía el formulario incompleto y marca los campos que faltan', () => {
    crear();

    component.crear();
    fixture.detectChanges();

    expect(servicio.crear).not.toHaveBeenCalled();
    expect(component.invalido('mascotaId')).toBeTrue();
    expect(component.invalido('procedimiento')).toBeTrue();
    expect(texto()).toContain('Indica el ID de la mascota.');
  });

  it('rechaza textos formados solo por espacios', () => {
    crear();
    llenarFormulario();
    component.form.patchValue({ alternativas: '    ' });

    component.crear();

    expect(servicio.crear).not.toHaveBeenCalled();
    expect(component.form.get('alternativas')?.errors).toEqual({ soloEspacios: true });
  });

  it('respeta los máximos que valida el servidor', () => {
    crear();
    llenarFormulario();
    component.form.patchValue({ procedimiento: 'x'.repeat(201) });

    expect(component.form.get('procedimiento')?.errors?.['maxlength']).toBeTruthy();
    component.form.patchValue({ procedimiento: 'x'.repeat(200), riesgosPrevisibles: 'x'.repeat(8001) });
    expect(component.form.get('riesgosPrevisibles')?.errors?.['maxlength']).toBeTruthy();
  });

  it('envía los datos sin espacios sobrantes y con la consulta vacía como nula', () => {
    crear();
    llenarFormulario();

    component.crear();

    expect(servicio.crear).toHaveBeenCalledWith(jasmine.objectContaining({
      mascotaId: 4,
      apoderadoId: 9,
      consultaId: null,
      procedimiento: 'Esterilización',
      autorizacionAnestesia: true,
      autorizacionEmergencia: false
    }));
  });

  it('al emitir limpia el formulario y vuelve a cargar la lista', () => {
    crear();
    llenarFormulario();

    component.crear();

    expect(component.trabajando()).toBeFalse();
    expect(component.form.value.procedimiento).toBe('');
    expect(servicio.listar).toHaveBeenCalledTimes(2);
  });

  it('si el servidor rechaza el documento, conserva lo escrito y avisa', () => {
    crear();
    llenarFormulario();
    servicio.crear.and.returnValue(throwError(() => ({ error: { message: 'La mascota no pertenece a la clínica' } })));
    const mensajes = fixture.debugElement.injector.get(MessageService);
    const aviso = spyOn(mensajes, 'add');

    component.crear();

    expect(aviso.calls.mostRecent().args[0].detail).toBe('La mascota no pertenece a la clínica');
    expect(component.form.value.procedimiento).toBe('  Esterilización  ');
    expect(component.trabajando()).toBeFalse();
    expect(servicio.listar).toHaveBeenCalledTimes(1);
  });

  it('muestra quién decidió y el motivo cuando el documento fue rechazado', () => {
    crear([documento({
      estado: 'RECHAZADO', decididoAt: '2026-10-13T12:00:00', nombreFirmante: 'Ana Torres',
      relacionFirmante: 'Propietaria', motivoRechazo: 'Prefiere otra clínica'
    })]);

    expect(texto()).toContain('Rechazado');
    expect(texto()).toContain('Ana Torres · Propietaria');
    expect(texto()).toContain('Prefiere otra clínica');
  });
});
