import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';
import { DerechosAdminComponent } from './derechos-admin.component';
import { DerechosDatosService } from '../../../../core/services/derechos-datos.service';
import { SolicitudDerechoDatos } from '../../../../models/privacy/derechos-datos.model';

describe('DerechosAdminComponent', () => {
  let fixture: ComponentFixture<DerechosAdminComponent>;
  let component: DerechosAdminComponent;
  let servicio: jasmine.SpyObj<DerechosDatosService>;

  const respuesta = <T>(data: T) => of({ success: true, message: 'ok', data });
  const html = () => fixture.nativeElement as HTMLElement;
  const texto = () => html().textContent?.replace(/\s+/g, ' ') ?? '';

  const solicitud = (parcial: Partial<SolicitudDerechoDatos> = {}): SolicitudDerechoDatos => ({
    id: 1, tipo: 'ACCESO', estado: 'RECIBIDA', descripcion: 'Quiero conocer mis datos', datoRectificar: null,
    identidadVerificada: true, metodoVerificacion: 'SESION', creadaAt: '2026-10-01T10:00:00', fechaLimite: '2026-10-21',
    vencida: false, respuesta: null, motivoRechazo: null, resueltaAt: null, titular: 'Ana Torres', correoTitular: 'ana@clinica.test',
    ...parcial
  });

  function crear(lista: SolicitudDerechoDatos[] = [solicitud()]): void {
    servicio = jasmine.createSpyObj<DerechosDatosService>('DerechosDatosService', ['listar', 'actualizar']);
    servicio.listar.and.returnValue(respuesta(lista));
    servicio.actualizar.and.returnValue(respuesta(solicitud({ estado: 'ATENDIDA' })));

    TestBed.configureTestingModule({
      imports: [DerechosAdminComponent],
      providers: [provideRouter([]), { provide: DerechosDatosService, useValue: servicio }]
    });
    fixture = TestBed.createComponent(DerechosAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('muestra cada solicitud con su tipo y estado en español', () => {
    crear([solicitud(), solicitud({ id: 2, tipo: 'RECTIFICACION', estado: 'EN_REVISION', datoRectificar: 'Mi teléfono es 999' })]);

    expect(texto()).toContain('Acceso · Ana Torres');
    expect(texto()).toContain('Rectificación · Ana Torres');
    expect(texto()).toContain('Recibida');
    expect(texto()).toContain('En revisión');
    expect(texto()).toContain('Mi teléfono es 999');
  });

  it('avisa cuando no hay solicitudes', () => {
    crear([]);
    expect(texto()).toContain('No hay solicitudes.');
  });

  it('si no se pueden cargar, muestra el motivo y permite reintentar', () => {
    crear();
    servicio.listar.and.returnValue(throwError(() => ({ error: { message: 'Sin permiso' } })));

    component.cargar();
    fixture.detectChanges();

    expect(texto()).toContain('Sin permiso');
    expect(texto()).toContain('Reintentar');
  });

  it('marca como vencida solo la solicitud abierta que pasó su límite', () => {
    crear([
      solicitud({ id: 1, vencida: true }),
      solicitud({ id: 2, vencida: true, estado: 'ATENDIDA', respuesta: 'Listo, ya tiene sus datos' })
    ]);

    expect(html().querySelectorAll('article')[0].textContent).toContain('Vencida');
    expect(html().querySelectorAll('article')[1].textContent).not.toContain('Vencida');
  });

  it('una solicitud recibida empieza en revisión y las resueltas no se pueden modificar', () => {
    crear([solicitud(), solicitud({ id: 2, estado: 'RECHAZADA', motivoRechazo: 'No corresponde a la clínica' })]);

    expect(component.formulario(1).controls.estado.value).toBe('EN_REVISION');
    expect(html().querySelectorAll('form').length).toBe(1);
    expect(texto()).toContain('Fundamento: No corresponde a la clínica');
  });

  it('en revisión se puede guardar sin respuesta', () => {
    crear();

    component.resolver(solicitud());

    expect(servicio.actualizar).toHaveBeenCalledWith(1, 'EN_REVISION', null, null);
  });

  it('para atender o pedir información exige una respuesta de al menos 10 caracteres', () => {
    crear();
    const formulario = component.formulario(1);
    formulario.controls.estado.setValue('ATENDIDA');

    component.resolver(solicitud());
    expect(servicio.actualizar).not.toHaveBeenCalled();
    expect(component.textoInvalido(1)).toBeTrue();

    formulario.controls.texto.setValue('   corto   ');
    component.resolver(solicitud());
    expect(servicio.actualizar).not.toHaveBeenCalled();

    formulario.controls.estado.setValue('REQUIERE_INFORMACION');
    formulario.controls.texto.setValue('Envíenos una copia de su documento');
    component.resolver(solicitud());
    expect(servicio.actualizar).toHaveBeenCalledWith(1, 'REQUIERE_INFORMACION', 'Envíenos una copia de su documento', null);
  });

  it('al rechazar envía el texto como fundamento y no como respuesta', () => {
    crear();
    const formulario = component.formulario(1);
    formulario.controls.estado.setValue('RECHAZADA');
    formulario.controls.texto.setValue('  No se puede verificar la identidad  ');

    component.resolver(solicitud());

    expect(servicio.actualizar).toHaveBeenCalledWith(1, 'RECHAZADA', null, 'No se puede verificar la identidad');
  });

  it('respeta los máximos del servidor según el estado', () => {
    crear();
    const formulario = component.formulario(1);
    formulario.controls.estado.setValue('RECHAZADA');
    formulario.controls.texto.setValue('x'.repeat(4001));
    expect(formulario.controls.texto.errors?.['maxlength']).toBeTruthy();

    formulario.controls.estado.setValue('ATENDIDA');
    expect(formulario.controls.texto.errors).toBeNull();
    formulario.controls.texto.setValue('x'.repeat(8001));
    expect(formulario.controls.texto.errors?.['maxlength']).toBeTruthy();
  });

  it('al guardar vuelve a cargar la lista y avisa', () => {
    crear();
    const aviso = spyOn(fixture.debugElement.injector.get(MessageService), 'add');
    const formulario = component.formulario(1);
    formulario.controls.estado.setValue('ATENDIDA');
    formulario.controls.texto.setValue('Adjuntamos copia de sus datos');

    component.resolver(solicitud());

    expect(servicio.listar).toHaveBeenCalledTimes(2);
    expect(component.trabajando()).toBeNull();
    expect(aviso.calls.mostRecent().args[0].severity).toBe('success');
  });

  it('si el servidor rechaza la actuación, muestra su mensaje y conserva lo escrito', () => {
    crear();
    servicio.actualizar.and.returnValue(throwError(() => ({ error: { message: 'Una solicitud resuelta no puede modificarse' } })));
    const aviso = spyOn(fixture.debugElement.injector.get(MessageService), 'add');
    const formulario = component.formulario(1);
    formulario.controls.estado.setValue('ATENDIDA');
    formulario.controls.texto.setValue('Adjuntamos copia de sus datos');

    component.resolver(solicitud());

    expect(aviso.calls.mostRecent().args[0].detail).toBe('Una solicitud resuelta no puede modificarse');
    expect(formulario.controls.texto.value).toBe('Adjuntamos copia de sus datos');
    expect(servicio.listar).toHaveBeenCalledTimes(1);
    expect(component.trabajando()).toBeNull();
  });
});
