import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { SolicitudesCancelacionComponent } from './solicitudes-cancelacion.component';
import { CancelacionDatosService } from '../../../../core/services/cancelacion-datos.service';
import { SolicitudCancelacion } from '../../../../models/privacy/cancelacion-datos.model';
import { ApoderadoService } from '../../../../core/services/apoderado.service';

describe('SolicitudesCancelacionComponent', () => {
  let fixture: ComponentFixture<SolicitudesCancelacionComponent>;
  let componente: SolicitudesCancelacionComponent;
  let servicio: jasmine.SpyObj<CancelacionDatosService>;
  let apoderados: jasmine.SpyObj<ApoderadoService>;

  const solicitud = (id: number, parcial: Partial<SolicitudCancelacion> = {}): SolicitudCancelacion => ({
    id, estado: 'PENDIENTE', canal: 'TITULAR', identidadVerificada: true, metodoVerificacion: 'Contraseña y código',
    motivoTitular: null, creadaAt: '2026-10-11T10:00:00', fechaLimite: '2026-10-23', vencida: false, resueltaAt: null,
    motivoResolucion: null, titularNombre: `Titular ${id}`, titularCorreo: `t${id}@correo.test`, titularDocumento: `4500000${id}`,
    puedeEjecutarse: true, impedimento: null, ...parcial
  });
  const respuesta = <T>(data: T) => of({ success: true, message: 'ok', data });
  const html = () => fixture.nativeElement as HTMLElement;
  const texto = () => html().textContent?.replace(/\s+/g, ' ') ?? '';

  async function crear(lista: SolicitudCancelacion[]) {
    servicio = jasmine.createSpyObj<CancelacionDatosService>('CancelacionDatosService', ['listar', 'registrar', 'ejecutar', 'rechazar']);
    servicio.listar.and.returnValue(respuesta(lista));
    servicio.ejecutar.and.returnValue(respuesta(solicitud(1, { estado: 'EJECUTADA' })));
    servicio.rechazar.and.returnValue(respuesta(solicitud(1, { estado: 'RECHAZADA' })));
    servicio.registrar.and.returnValue(respuesta(solicitud(9)));
    apoderados = jasmine.createSpyObj<ApoderadoService>('ApoderadoService', ['listar']);
    apoderados.listar.and.returnValue(respuesta({ content: [{ id: 3, nombre: 'Ana', apellido: 'Torres', numeroDocumento: '45871236' }] }) as any);
    await TestBed.configureTestingModule({
      imports: [SolicitudesCancelacionComponent],
      providers: [
        provideRouter([]),
        { provide: CancelacionDatosService, useValue: servicio },
        { provide: ApoderadoService, useValue: apoderados },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(SolicitudesCancelacionComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('muestra por defecto las pendientes con quién es el titular y cómo se verificó su identidad', async () => {
    await crear([solicitud(1), solicitud(2, { estado: 'EJECUTADA', resueltaAt: '2026-10-12T09:00:00' })]);

    expect(texto()).toContain('Titular 1');
    expect(texto()).toContain('t1@correo.test');
    expect(texto()).toContain('Contraseña y código');
    expect(texto()).not.toContain('Titular 2');
  });

  it('permite ver las resueltas y todas', async () => {
    await crear([solicitud(1), solicitud(2, { estado: 'RECHAZADA', motivoResolucion: 'Hay una obligación legal' })]);

    componente.seleccionarFiltro('RESUELTAS');
    fixture.detectChanges();
    expect(texto()).toContain('Titular 2');
    expect(texto()).toContain('Hay una obligación legal');
    expect(texto()).not.toContain('Titular 1');

    componente.seleccionarFiltro('TODAS');
    fixture.detectChanges();
    expect(texto()).toContain('Titular 1');
    expect(texto()).toContain('Titular 2');
  });

  it('avisa de las solicitudes con el plazo vencido', async () => {
    await crear([solicitud(1, { vencida: true }), solicitud(2)]);

    expect(texto()).toContain('1 con el plazo vencido');
    expect(texto()).toContain('Plazo vencido');
  });

  it('si hay un impedimento lo explica y no deja ejecutar', async () => {
    await crear([solicitud(1, { puedeEjecutarse: false, impedimento: 'Tiene citas programadas.' })]);

    expect(texto()).toContain('No se puede ejecutar todavía');
    expect(texto()).toContain('Tiene citas programadas.');
    const boton = [...html().querySelectorAll('button')].find(b => /Cancelar sus datos/.test(b.textContent ?? '')) as HTMLButtonElement;
    expect(boton.disabled).toBeTrue();
  });

  it('antes de ejecutar explica lo que pasa y advierte que no se puede deshacer', async () => {
    await crear([solicitud(1)]);

    componente.abrirEjecutar(componente.pendientes()[0]);
    fixture.detectChanges();

    const dialogo = html().querySelector('[role="dialog"]')!.textContent!.replace(/\s+/g, ' ');
    expect(dialogo).toContain('Se retiran su nombre, documento, correo, teléfono y dirección');
    expect(dialogo).toContain('se conservan, sin identificarla');
    expect(dialogo).toContain('no se puede deshacer');
    expect(servicio.ejecutar).not.toHaveBeenCalled();
  });

  it('al confirmar ejecuta la solicitud, cierra el diálogo y recarga la lista', async () => {
    await crear([solicitud(1)]);
    servicio.listar.calls.reset();
    componente.abrirEjecutar(componente.pendientes()[0]);

    componente.confirmarEjecutar();
    fixture.detectChanges();

    expect(servicio.ejecutar).toHaveBeenCalledWith(1);
    expect(componente.dialogo()).toBeNull();
    expect(servicio.listar).toHaveBeenCalledTimes(1);
    expect(texto()).toContain('Los datos personales fueron cancelados');
  });

  it('si el servidor rechaza la ejecución muestra el motivo y mantiene el diálogo abierto', async () => {
    await crear([solicitud(1)]);
    servicio.ejecutar.and.returnValue(throwError(() => ({ error: { message: 'Tiene una deuda pendiente de S/ 80.00.' } })));
    componente.abrirEjecutar(componente.pendientes()[0]);

    componente.confirmarEjecutar();
    fixture.detectChanges();

    expect(componente.error()).toContain('deuda pendiente');
    expect(componente.dialogo()).not.toBeNull();
    expect(componente.trabajando()).toBeFalse();
  });

  it('rechazar exige un motivo de al menos 10 caracteres', async () => {
    await crear([solicitud(1)]);
    componente.abrirRechazar(componente.pendientes()[0]);

    componente.motivoRechazo.set('corto');
    componente.confirmarRechazo();
    expect(servicio.rechazar).not.toHaveBeenCalled();

    componente.motivoRechazo.set('Existe una obligación legal de conservación');
    componente.confirmarRechazo();
    expect(servicio.rechazar).toHaveBeenCalledWith(1, 'Existe una obligación legal de conservación');
  });

  it('registrar a nombre de un cliente pide elegirlo y describir cómo se verificó su identidad', async () => {
    await crear([]);
    componente.abrirRegistrar();

    expect(componente.registroValido()).toBeFalse();

    componente.busqueda.set('ana');
    componente.buscarClientes();
    expect(apoderados.listar).toHaveBeenCalledWith(undefined, 'ana', undefined, 0, 6, true);
    componente.elegirCliente(componente.resultados()[0]);
    componente.metodoVerificacion.set('xx');
    expect(componente.registroValido()).toBeFalse();
    componente.metodoVerificacion.set('Presentó su DNI en el mostrador');
    expect(componente.registroValido()).toBeTrue();

    componente.confirmarRegistro();
    expect(servicio.registrar).toHaveBeenCalledWith({
      apoderadoId: 3, metodoVerificacion: 'Presentó su DNI en el mostrador', motivo: null
    });
  });

  it('no busca clientes con menos de dos letras', async () => {
    await crear([]);
    componente.abrirRegistrar();

    componente.busqueda.set('a');
    componente.buscarClientes();

    expect(apoderados.listar).not.toHaveBeenCalled();
  });

  it('el diseño es plano: sin sombras, transiciones ni amarillo de alerta', async () => {
    await crear([solicitud(1, { vencida: true, impedimento: 'Tiene citas programadas.' })]);
    componente.abrirEjecutar(componente.pendientes()[0]);
    fixture.detectChanges();

    expect(html().innerHTML).not.toMatch(/shadow|transition|amber|yellow/);
  });
});
