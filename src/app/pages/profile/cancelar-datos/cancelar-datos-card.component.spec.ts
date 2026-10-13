import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { CancelarDatosCardComponent } from './cancelar-datos-card.component';
import { CancelacionDatosService } from '../../../core/services/cancelacion-datos.service';
import {
  CancelacionDatosElegibilidad,
  SolicitudCancelacion
} from '../../../models/privacy/cancelacion-datos.model';
import { AuthStore } from '../../../store/auth.store';

describe('CancelarDatosCardComponent', () => {
  let fixture: ComponentFixture<CancelarDatosCardComponent>;
  let componente: CancelarDatosCardComponent;
  let servicio: jasmine.SpyObj<CancelacionDatosService>;

  const solicitud = (parcial: Partial<SolicitudCancelacion> = {}): SolicitudCancelacion => ({
    id: 1, estado: 'PENDIENTE', canal: 'TITULAR', identidadVerificada: true, metodoVerificacion: 'Contraseña y código',
    motivoTitular: null, creadaAt: '2026-10-11T10:00:00', fechaLimite: '2026-10-23', vencida: false, resueltaAt: null,
    motivoResolucion: null, titularNombre: null, titularCorreo: null, titularDocumento: null, puedeEjecutarse: false,
    impedimento: null, ...parcial
  });
  const estado = (parcial: Partial<CancelacionDatosElegibilidad> = {}): CancelacionDatosElegibilidad =>
    ({ puedeSolicitar: true, motivoBloqueo: null, requierePassword: true, solicitudVigente: null, ...parcial });
  const respuesta = <T>(data: T) => of({ success: true, message: 'Te enviamos un código', data });
  const texto = () => (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ') ?? '';

  async function crear(proposito: string, elegibilidad: CancelacionDatosElegibilidad = estado()) {
    servicio = jasmine.createSpyObj<CancelacionDatosService>('CancelacionDatosService', ['estado', 'pedirCodigo', 'solicitar']);
    servicio.estado.and.returnValue(respuesta(elegibilidad));
    servicio.pedirCodigo.and.returnValue(respuesta({ retryAfterSeconds: 60 }));
    servicio.solicitar.and.returnValue(respuesta(solicitud()));
    await TestBed.configureTestingModule({
      imports: [CancelarDatosCardComponent],
      providers: [
        { provide: CancelacionDatosService, useValue: servicio },
        { provide: AuthStore, useValue: { activeRolePurpose: () => proposito } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(CancelarDatosCardComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  }

  afterEach(() => componente?.cancelar());

  it('solo los clientes ven la opción, y para otros roles no consulta nada', async () => {
    await crear('COMPANY_ADMIN');

    expect(texto()).not.toContain('Cancelar mis datos personales');
    expect(servicio.estado).not.toHaveBeenCalled();
  });

  it('explica qué se elimina, qué se conserva y que el cierre es definitivo', async () => {
    await crear('CLIENT_PORTAL');

    expect(texto()).toContain('nombre, documento, correo, teléfono y dirección');
    expect(texto()).toContain('conserva los registros clínicos y comerciales');
    expect(texto()).toContain('no se puede reactivar');
  });

  it('con una solicitud en revisión muestra el plazo y no deja pedir otra', async () => {
    await crear('CLIENT_PORTAL', estado({ puedeSolicitar: false, solicitudVigente: solicitud() }));

    expect(texto()).toContain('Tu solicitud está en revisión');
    expect(texto()).toContain('23/10/2026');
    expect((fixture.nativeElement as HTMLElement).querySelector('button')).toBeNull();
  });

  it('si la clínica rechazó la anterior muestra el motivo y permite volver a pedir', async () => {
    await crear('CLIENT_PORTAL', estado({ solicitudVigente: solicitud({ estado: 'RECHAZADA', motivoResolucion: 'Tiene una deuda pendiente' }) }));

    expect(texto()).toContain('Tiene una deuda pendiente');
    expect(texto()).toContain('Solicitar la cancelación de mis datos');
  });

  it('pide la contraseña antes de enviar el código', async () => {
    await crear('CLIENT_PORTAL');
    componente.abrir();

    componente.enviarCodigo();

    expect(servicio.pedirCodigo).not.toHaveBeenCalled();
    expect(componente.error()).toContain('contraseña');
  });

  it('con la contraseña envía el código y pasa al paso de verificación', async () => {
    await crear('CLIENT_PORTAL');
    componente.abrir();
    componente.password.set('Clave!1');

    componente.enviarCodigo();

    expect(servicio.pedirCodigo).toHaveBeenCalledWith('Clave!1');
    expect(componente.paso()).toBe('codigo');
    expect(componente.espera()).toBe(60);
  });

  it('una cuenta sin contraseña pide el código sin enviarla', async () => {
    await crear('CLIENT_PORTAL', estado({ requierePassword: false }));
    componente.abrir();

    componente.enviarCodigo();

    expect(servicio.pedirCodigo).toHaveBeenCalledWith(null);
  });

  it('una contraseña incorrecta muestra el mensaje del servidor y no avanza', async () => {
    await crear('CLIENT_PORTAL');
    servicio.pedirCodigo.and.returnValue(throwError(() => ({ error: { message: 'La contraseña es incorrecta' } })));
    componente.abrir();
    componente.password.set('mala');

    componente.enviarCodigo();

    expect(componente.error()).toBe('La contraseña es incorrecta');
    expect(componente.paso()).toBe('inicio');
  });

  it('un código incompleto no se envía', async () => {
    await crear('CLIENT_PORTAL');
    componente.abrir();
    componente.codigo.set('12');

    componente.confirmar();

    expect(servicio.solicitar).not.toHaveBeenCalled();
    expect(componente.error()).toContain('6 dígitos');
  });

  it('con el código correcto registra la solicitud con el motivo y vuelve a consultar el estado', async () => {
    await crear('CLIENT_PORTAL');
    componente.abrir();
    componente.motivo.set('  Ya no soy cliente  ');
    componente.codigo.set('123456');
    servicio.estado.calls.reset();

    componente.confirmar();

    expect(servicio.solicitar).toHaveBeenCalledWith('123456', 'Ya no soy cliente');
    expect(componente.paso()).toBe('listo');
    expect(servicio.estado).toHaveBeenCalledTimes(1);
  });

  it('un código inválido muestra el error y deja reintentar', async () => {
    await crear('CLIENT_PORTAL');
    servicio.solicitar.and.returnValue(throwError(() => ({ error: { message: 'El código no es correcto.' } })));
    componente.abrir();
    componente.codigo.set('000000');

    componente.confirmar();

    expect(componente.error()).toBe('El código no es correcto.');
    expect(componente.trabajando()).toBeFalse();
  });

  it('el diseño es plano: sin sombras, transiciones ni amarillo de alerta', async () => {
    await crear('CLIENT_PORTAL');
    componente.abrir();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).innerHTML).not.toMatch(/shadow|transition|amber|yellow/);
  });
});
