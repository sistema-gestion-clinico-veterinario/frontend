import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';
import { DerechosDatosComponent } from './derechos-datos.component';
import { DerechosDatosService } from '../../core/services/derechos-datos.service';
import { SolicitudDerechoDatos } from '../../models/privacy/derechos-datos.model';

describe('DerechosDatosComponent', () => {
  let fixture: ComponentFixture<DerechosDatosComponent>;
  let component: DerechosDatosComponent;
  let servicio: jasmine.SpyObj<DerechosDatosService>;

  const respuesta = <T>(data: T) => of({ success: true, message: 'ok', data });
  const html = () => fixture.nativeElement as HTMLElement;
  const texto = () => html().textContent?.replace(/\s+/g, ' ') ?? '';

  const solicitud = (parcial: Partial<SolicitudDerechoDatos> = {}): SolicitudDerechoDatos => ({
    id: 7, tipo: 'ACCESO', estado: 'EN_REVISION', descripcion: 'Quiero conocer mis datos', datoRectificar: null,
    identidadVerificada: true, metodoVerificacion: 'SESION', creadaAt: '2026-10-01T10:00:00', fechaLimite: '2026-10-21',
    vencida: false, respuesta: null, motivoRechazo: null, resueltaAt: null, titular: 'Ana Torres', correoTitular: 'ana@clinica.test',
    ...parcial
  });

  function crear(lista: SolicitudDerechoDatos[] = []): void {
    servicio = jasmine.createSpyObj<DerechosDatosService>('DerechosDatosService', ['listarMias', 'crear']);
    servicio.listarMias.and.returnValue(respuesta(lista));
    servicio.crear.and.returnValue(respuesta(solicitud()));

    TestBed.configureTestingModule({
      imports: [DerechosDatosComponent],
      providers: [provideRouter([])]
    }).overrideProvider(DerechosDatosService, { useValue: servicio });
    fixture = TestBed.createComponent(DerechosDatosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('muestra el seguimiento con el derecho y el estado en español', () => {
    crear([solicitud(), solicitud({ id: 8, tipo: 'PORTABILIDAD', estado: 'ATENDIDA', respuesta: 'Le enviamos sus datos' })]);

    expect(texto()).toContain('Acceso · solicitud 7');
    expect(texto()).toContain('En revisión');
    expect(texto()).toContain('Portabilidad · solicitud 8');
    expect(texto()).toContain('Respuesta: Le enviamos sus datos');
  });

  it('avisa cuando todavía no hay solicitudes', () => {
    crear([]);
    expect(texto()).toContain('Aún no tienes solicitudes.');
  });

  it('si no puede cargar el seguimiento, muestra el motivo y permite reintentar', () => {
    crear();
    servicio.listarMias.and.returnValue(throwError(() => ({ error: { message: 'Sin conexión' } })));

    component.cargar();
    fixture.detectChanges();

    expect(texto()).toContain('Sin conexión');
    expect(texto()).toContain('Reintentar');
  });

  it('el plazo vencido solo se anuncia mientras la solicitud sigue abierta', () => {
    crear([solicitud({ vencida: true }), solicitud({ id: 8, vencida: true, estado: 'ATENDIDA' })]);

    const tarjetas = html().querySelectorAll('article');
    expect(tarjetas[0].textContent).toContain('Plazo vencido');
    expect(tarjetas[1].textContent).not.toContain('Plazo vencido');
  });

  it('la ayuda cambia según el derecho elegido', () => {
    crear();
    expect(component.ayuda()).toContain('qué datos conserva');

    component.form.controls.tipo.setValue('OPOSICION');
    fixture.detectChanges();

    expect(html().querySelector('[data-testid="ayuda"]')?.textContent).toContain('deje de realizarse');
  });

  it('no registra una solicitud con un detalle demasiado corto', () => {
    crear();
    component.form.patchValue({ descripcion: '   corto   ' });

    component.crear();
    fixture.detectChanges();

    expect(servicio.crear).not.toHaveBeenCalled();
    expect(component.invalido('descripcion')).toBeTrue();
    expect(texto()).toContain('al menos 10 caracteres');
  });

  it('la rectificación pide el dato y la corrección; los demás derechos no', () => {
    crear();
    component.form.patchValue({ descripcion: 'Mi teléfono está desactualizado' });

    expect(html().querySelector('#datoRectificar')).toBeNull();
    component.crear();
    expect(servicio.crear).toHaveBeenCalledTimes(1);

    component.form.patchValue({ tipo: 'RECTIFICACION', descripcion: 'Mi teléfono está desactualizado' });
    fixture.detectChanges();
    expect(html().querySelector('#datoRectificar')).not.toBeNull();
    component.crear();
    expect(servicio.crear).toHaveBeenCalledTimes(1);
    expect(component.invalido('datoRectificar')).toBeTrue();

    component.form.patchValue({ datoRectificar: 'Teléfono 999 por 988' });
    component.crear();
    expect(servicio.crear).toHaveBeenCalledWith('RECTIFICACION', 'Mi teléfono está desactualizado', 'Teléfono 999 por 988');
  });

  it('envía el texto sin espacios sobrantes y la corrección vacía como nula', () => {
    crear();
    component.form.patchValue({ descripcion: '  Quiero una copia de mis datos  ' });

    component.crear();

    expect(servicio.crear).toHaveBeenCalledWith('ACCESO', 'Quiero una copia de mis datos', null);
  });

  it('al registrar limpia el detalle, conserva el derecho elegido y recarga el seguimiento', () => {
    crear();
    component.form.patchValue({ tipo: 'PORTABILIDAD', descripcion: 'Quiero mis datos en un archivo' });

    component.crear();

    expect(component.form.value.descripcion).toBe('');
    expect(component.form.value.tipo).toBe('PORTABILIDAD');
    expect(component.guardando()).toBeFalse();
    expect(servicio.listarMias).toHaveBeenCalledTimes(2);
  });

  it('si el servidor rechaza la solicitud, avisa y conserva lo escrito', () => {
    crear();
    servicio.crear.and.returnValue(throwError(() => ({ error: { message: 'Ya tienes una solicitud abierta' } })));
    const aviso = spyOn(fixture.debugElement.injector.get(MessageService), 'add');
    component.form.patchValue({ descripcion: 'Quiero conocer mis datos' });

    component.crear();

    expect(aviso.calls.mostRecent().args[0].detail).toBe('Ya tienes una solicitud abierta');
    expect(component.form.value.descripcion).toBe('Quiero conocer mis datos');
    expect(component.guardando()).toBeFalse();
  });
});
