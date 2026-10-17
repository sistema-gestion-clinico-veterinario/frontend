import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';
import { ConsentimientosComponent } from './consentimientos.component';
import { ConsentimientoVeterinarioService } from '../../../core/services/consentimiento-veterinario.service';
import { ConsentimientoVeterinario } from '../../../models/privacy/consentimiento-veterinario.model';

describe('ConsentimientosComponent (portal del apoderado)', () => {
  let fixture: ComponentFixture<ConsentimientosComponent>;
  let component: ConsentimientosComponent;
  let servicio: jasmine.SpyObj<ConsentimientoVeterinarioService>;

  const respuesta = <T>(data: T) => of({ success: true, message: 'ok', data });
  const html = () => fixture.nativeElement as HTMLElement;
  const texto = () => html().textContent?.replace(/\s+/g, ' ') ?? '';

  const documento = (parcial: Partial<ConsentimientoVeterinario> = {}): ConsentimientoVeterinario => ({
    uuid: 'u-1', mascotaId: 4, mascota: 'Luna', consultaId: null, apoderadoId: 9, titular: 'Ana Torres',
    procedimiento: 'Esterilización', diagnosticoIndicacion: 'd', descripcionProcedimiento: 'p', beneficiosEsperados: 'b',
    riesgosPrevisibles: 'r', alternativas: 'a', consecuenciasNoRealizar: 'c', autorizacionAnestesia: true,
    autorizacionEmergencia: false, version: 2, contenido: 'CONSENTIMIENTO INFORMADO', contenidoHash: 'abc123',
    estado: 'PENDIENTE', creadoAt: '2026-10-13T10:00:00', decididoAt: null, nombreFirmante: null, documentoFirmante: null,
    relacionFirmante: null, preguntasAclaradas: false, motivoRechazo: null, revocadoAt: null, motivoRevocacion: null,
    ...parcial
  });

  function crear(lista: ConsentimientoVeterinario[] = [documento()]): void {
    servicio = jasmine.createSpyObj<ConsentimientoVeterinarioService>('ConsentimientoVeterinarioService',
      ['listarMios', 'decidir', 'revocarMio']);
    servicio.listarMios.and.returnValue(respuesta(lista));
    servicio.decidir.and.returnValue(respuesta(documento({ estado: 'ACEPTADO' })));
    servicio.revocarMio.and.returnValue(respuesta(documento({ estado: 'REVOCADO' })));

    TestBed.configureTestingModule({
      imports: [ConsentimientosComponent],
      providers: [provideRouter([]), { provide: ConsentimientoVeterinarioService, useValue: servicio }]
    });
    fixture = TestBed.createComponent(ConsentimientosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  const llenar = (uuid = 'u-1', cambios: Record<string, unknown> = {}) =>
    component.formulario(uuid).patchValue({ nombre: '  Ana Torres  ', documento: ' 12345678 ', aclaradas: true, ...cambios });

  it('muestra cada documento con su procedimiento, mascota y estado en español', () => {
    crear([documento(), documento({ uuid: 'u-2', estado: 'ACEPTADO', procedimiento: 'Limpieza dental' })]);

    expect(texto()).toContain('Esterilización');
    expect(texto()).toContain('Luna · versión 2');
    expect(texto()).toContain('Pendiente de decisión');
    expect(texto()).toContain('Aceptado');
    expect(texto()).toContain('Huella SHA-256: abc123');
  });

  it('avisa cuando no hay consentimientos', () => {
    crear([]);
    expect(texto()).toContain('No tienes consentimientos registrados.');
  });

  it('si no se pueden cargar, muestra el motivo y permite reintentar', () => {
    crear();
    servicio.listarMios.and.returnValue(throwError(() => ({ error: { message: 'Sin acceso' } })));

    component.cargar();
    fixture.detectChanges();

    expect(texto()).toContain('Sin acceso');
    expect(texto()).toContain('Reintentar');
  });

  it('solo un documento pendiente ofrece decidir y solo uno aceptado ofrece revocar', () => {
    crear([documento(), documento({ uuid: 'u-2', estado: 'ACEPTADO' }), documento({ uuid: 'u-3', estado: 'RECHAZADO', motivoRechazo: 'No lo necesita' })]);

    expect(texto()).toContain('Aceptar y autorizar');
    expect(texto()).toContain('Revocar antes del procedimiento');
    expect(html().querySelectorAll('form').length).toBe(2);
    expect(texto()).toContain('Motivo del rechazo: No lo necesita');
  });

  it('para decidir exige nombre y documento', () => {
    crear();

    component.decidir(documento(), true);
    fixture.detectChanges();

    expect(servicio.decidir).not.toHaveBeenCalled();
    expect(component.campoInvalido('u-1', 'nombre')).toBeTrue();
    expect(texto()).toContain('Escribe tu nombre completo y tu número de documento.');
  });

  it('no permite aceptar sin confirmar que pudo formular preguntas', () => {
    crear();
    llenar('u-1', { aclaradas: false });

    component.decidir(documento(), true);

    expect(servicio.decidir).not.toHaveBeenCalled();
    expect(component.avisos()['u-1']).toContain('formular preguntas');
  });

  it('acepta enviando los datos sin espacios sobrantes y sin motivo de rechazo', () => {
    crear();
    llenar();

    component.decidir(documento(), true);

    expect(servicio.decidir).toHaveBeenCalledWith('u-1', {
      aceptar: true, nombreFirmante: 'Ana Torres', documentoFirmante: '12345678', preguntasAclaradas: true, motivoRechazo: null
    });
  });

  it('para rechazar exige un motivo de al menos 10 caracteres', () => {
    crear();
    llenar('u-1', { aclaradas: false, motivo: '  corto  ' });

    component.decidir(documento(), false);
    expect(servicio.decidir).not.toHaveBeenCalled();
    expect(component.avisos()['u-1']).toContain('motivo del rechazo');

    component.formulario('u-1').patchValue({ motivo: ' Prefiero otra alternativa ' });
    component.decidir(documento(), false);
    expect(servicio.decidir).toHaveBeenCalledWith('u-1', {
      aceptar: false, nombreFirmante: 'Ana Torres', documentoFirmante: '12345678', preguntasAclaradas: false,
      motivoRechazo: 'Prefiero otra alternativa'
    });
  });

  it('al decidir recarga la lista y avisa', () => {
    crear();
    llenar();
    const aviso = spyOn(fixture.debugElement.injector.get(MessageService), 'add');

    component.decidir(documento(), true);

    expect(servicio.listarMios).toHaveBeenCalledTimes(2);
    expect(component.trabajando()).toBeNull();
    expect(aviso.calls.mostRecent().args[0].severity).toBe('success');
  });

  it('si el servidor rechaza la decisión, muestra su mensaje y conserva lo escrito', () => {
    crear();
    llenar();
    servicio.decidir.and.returnValue(throwError(() => ({ error: { message: 'El documento no coincide con el titular autenticado' } })));
    const aviso = spyOn(fixture.debugElement.injector.get(MessageService), 'add');

    component.decidir(documento(), true);

    expect(aviso.calls.mostRecent().args[0].detail).toBe('El documento no coincide con el titular autenticado');
    expect(component.formulario('u-1').value.nombre).toBe('  Ana Torres  ');
    expect(component.trabajando()).toBeNull();
  });

  it('para revocar exige un motivo de al menos 10 caracteres y lo envía sin espacios sobrantes', () => {
    crear([documento({ estado: 'ACEPTADO' })]);

    component.revocar(documento({ estado: 'ACEPTADO' }));
    expect(servicio.revocarMio).not.toHaveBeenCalled();

    component.formulario('u-1').patchValue({ motivoRevocacion: 'corto' });
    component.revocar(documento({ estado: 'ACEPTADO' }));
    expect(servicio.revocarMio).not.toHaveBeenCalled();

    component.formulario('u-1').patchValue({ motivoRevocacion: '  Cambié de opinión  ' });
    component.revocar(documento({ estado: 'ACEPTADO' }));
    expect(servicio.revocarMio).toHaveBeenCalledWith('u-1', 'Cambié de opinión');
  });
});
