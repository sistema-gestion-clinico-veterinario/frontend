import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { PrivacidadComponent } from './privacidad.component';
import { AvisoVersion, CamposAvisoPrivacidad, PrivacidadService, VistaPreviaAviso } from '../../../core/services/privacidad.service';
import { AuthStore } from '../../../store/auth.store';

describe('PrivacidadComponent', () => {
  let fixture: ComponentFixture<PrivacidadComponent>;
  let component: PrivacidadComponent;
  let servicio: jasmine.SpyObj<PrivacidadService>;

  const campos: CamposAvisoPrivacidad = {
    razonSocial: 'Clínica Patitas S.A.C.', ruc: '20123456789', domicilio: 'Av. Los Olivos 123, Lima',
    correoDerechos: 'privacidad@patitas.test', registroBancoDatos: null, encargadoTratamiento: 'VetSoft',
    finalidades: ['Atender a su mascota'], datosObligatorios: ['Nombres y apellidos'], datosFacultativos: [],
    destinatarios: ['El personal de la clínica'], transferencias: 'No se transfieren datos fuera del Perú',
    plazoConservacion: 'Mientras sea cliente'
  };
  const version = (parcial: Partial<AvisoVersion> = {}): AvisoVersion => ({
    audiencia: 'PROPIETARIOS_Y_AUTORIZADOS', version: 1, contenido: 'AVISO DE PRIVACIDAD - Versión 1', contenidoHash: 'abc', vigenteDesde: '2026-10-06T10:15:00',
    activo: true, creadoPor: 'felipe@patitas.test', creadoDispositivo: 'Chrome en Windows', creadoIp: '190.40.10.5', campos, ...parcial
  });
  const previa = (parcial: Partial<VistaPreviaAviso> = {}): VistaPreviaAviso => ({
    version: 2, contenido: 'AVISO DE PRIVACIDAD - Versión 2\n\n1. Quién trata sus datos', sinCambios: false, observaciones: [], ...parcial
  });
  const respuesta = <T>(data: T) => of({ success: true, message: 'ok', data });
  const html = () => fixture.nativeElement as HTMLElement;
  const texto = () => html().textContent?.replace(/\s+/g, ' ') ?? '';

  async function crear(proposito: string, historial: AvisoVersion[] = [version()]) {
    servicio = jasmine.createSpyObj<PrivacidadService>('PrivacidadService', ['plantilla', 'historial', 'vistaPrevia', 'publicar']);
    servicio.plantilla.and.returnValue(respuesta(campos));
    servicio.historial.and.returnValue(respuesta(historial));
    servicio.vistaPrevia.and.returnValue(respuesta(previa()));
    servicio.publicar.and.returnValue(respuesta(version({ version: 2 })));
    await TestBed.configureTestingModule({
      imports: [PrivacidadComponent],
      providers: [
        provideRouter([]),
        { provide: PrivacidadService, useValue: servicio },
        { provide: AuthStore, useValue: { activeRolePurpose: () => proposito, hasAccess: () => true } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PrivacidadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  describe('administrador de la clínica', () => {
    beforeEach(async () => crear('COMPANY_ADMIN'));

    it('ve el formulario, la vista previa y la constancia de quién publicó cada versión', () => {
      expect(servicio.plantilla).toHaveBeenCalled();
      expect(html().querySelector('form')).not.toBeNull();
      expect(texto()).toContain('Vista previa');
      expect(texto()).toContain('Publicado por felipe@patitas.test');
      expect(texto()).toContain('Dispositivo: Chrome en Windows');
      expect(texto()).toContain('IP 190.40.10.5');
    });

    it('las versiones anteriores a la constancia dicen que no está registrada, sin inventar datos', async () => {
      TestBed.resetTestingModule();
      await crear('COMPANY_ADMIN', [version({ creadoPor: null, creadoDispositivo: null, creadoIp: null })]);

      expect(texto()).toContain('Publicado por usuario no registrado');
      expect(texto()).toContain('Dispositivo: no registrado');
      expect(texto()).not.toContain('· IP');
    });

    it('la vista previa muestra el texto sin publicar nada, aunque falten datos', () => {
      component.form.patchValue({ razonSocial: '' });

      component.verVistaPrevia();
      fixture.detectChanges();

      expect(servicio.vistaPrevia).toHaveBeenCalledTimes(1);
      expect(servicio.publicar).not.toHaveBeenCalled();
      expect(html().querySelector('[role="dialog"]')?.textContent).toContain('Todavía no se ha publicado nada');
      expect(texto()).toContain('Quién trata sus datos');
      expect(html().querySelector('[role="dialog"] button:last-child')?.textContent).toContain('Cerrar');
    });

    it('publicar abre primero la vista previa y solo se publica al confirmarla', () => {
      component.form.controls.confirmoRevisionLegal.setValue(true);

      component.solicitarPublicacion();
      fixture.detectChanges();

      expect(servicio.publicar).not.toHaveBeenCalled();
      expect(html().querySelector('[role="dialog"]')?.textContent).toContain('se publicará como la versión 2');
      expect(html().querySelector('[role="dialog"]')?.textContent).toContain('quién lo publicó, cuándo y desde qué dispositivo');

      component.confirmarPublicacion();

      expect(servicio.publicar).toHaveBeenCalledTimes(1);
      expect(servicio.publicar.calls.mostRecent().args[0].ruc).toBe('20123456789');
      expect(servicio.publicar.calls.mostRecent().args[1]).toBeTrue();
      expect(servicio.publicar.calls.mostRecent().args[2]).toBe('PROPIETARIOS_Y_AUTORIZADOS');
    });

    it('si falta la confirmación de la revisión legal no se abre ni se publica', () => {
      component.form.controls.confirmoRevisionLegal.setValue(false);

      component.solicitarPublicacion();

      expect(servicio.vistaPrevia).not.toHaveBeenCalled();
      expect(servicio.publicar).not.toHaveBeenCalled();
    });

    it('con observaciones pendientes o sin cambios, el botón de confirmar está bloqueado y no se publica', () => {
      component.form.controls.confirmoRevisionLegal.setValue(true);
      servicio.vistaPrevia.and.returnValue(respuesta(previa({ observaciones: ['Falta el RUC'] })));
      component.solicitarPublicacion();
      fixture.detectChanges();

      const confirmar = [...html().querySelectorAll('[role="dialog"] button')].find(b => /Confirmar y publicar/.test(b.textContent ?? '')) as HTMLButtonElement;
      expect(texto()).toContain('Falta el RUC');
      expect(confirmar.disabled).toBeTrue();
      component.confirmarPublicacion();
      expect(servicio.publicar).not.toHaveBeenCalled();

      servicio.vistaPrevia.and.returnValue(respuesta(previa({ sinCambios: true })));
      component.solicitarPublicacion();
      fixture.detectChanges();
      expect(texto()).toContain('igual al aviso vigente');
      component.confirmarPublicacion();
      expect(servicio.publicar).not.toHaveBeenCalled();
    });

    it('seguir editando cierra la vista previa y conserva lo escrito', () => {
      component.form.patchValue({ domicilio: 'Jr. Cusco 456' });
      component.verVistaPrevia();
      fixture.detectChanges();

      component.cerrarVistaPrevia();
      fixture.detectChanges();

      expect(html().querySelector('[role="dialog"]')).toBeNull();
      expect(component.form.controls.domicilio.value).toBe('Jr. Cusco 456');
    });

    it('si no se pudo generar la vista previa, avisa y no abre nada', () => {
      servicio.vistaPrevia.and.returnValue(throwError(() => ({ error: { message: 'Sin permiso' } })));

      component.verVistaPrevia();
      fixture.detectChanges();

      expect(component.vistaPrevia()).toBeNull();
      expect(component.cargandoVistaPrevia()).toBeFalse();
    });

    it('al publicar se cierra la vista previa y se actualiza el historial', () => {
      component.form.controls.confirmoRevisionLegal.setValue(true);
      component.solicitarPublicacion();

      component.confirmarPublicacion();
      fixture.detectChanges();

      expect(component.vistaPrevia()).toBeNull();
      expect(servicio.historial).toHaveBeenCalledTimes(2);
    });

    it('mantiene separados el formulario y el historial de trabajadores', () => {
      component.seleccionarAudiencia('TRABAJADORES_Y_USUARIOS');

      expect(servicio.plantilla).toHaveBeenCalledWith('TRABAJADORES_Y_USUARIOS');
      expect(servicio.historial).toHaveBeenCalledWith('TRABAJADORES_Y_USUARIOS');
      expect(component.audiencia()).toBe('TRABAJADORES_Y_USUARIOS');
    });

    it('el diseño es plano: sin sombras, transiciones ni amarillo de alerta', () => {
      component.verVistaPrevia();
      fixture.detectChanges();

      expect(html().innerHTML).not.toMatch(/shadow|transition|amber|yellow/);
    });
  });

  describe('personal que no es administrador de la clínica', () => {
    beforeEach(async () => crear('CUSTOM'));

    it('solo consulta la versión vigente y el historial, sin formulario ni plantilla', () => {
      expect(servicio.plantilla).not.toHaveBeenCalled();
      expect(servicio.historial).toHaveBeenCalled();
      expect(html().querySelector('form')).toBeNull();
      expect(texto()).toContain('Solo el administrador de la clínica puede redactar y publicar el aviso de privacidad');
      expect(texto()).toContain('Publicado por felipe@patitas.test');
      expect(texto()).not.toContain('Publicar nueva versión');
    });

    it('aunque se fuerce desde el código, no se genera vista previa ni se publica', () => {
      component.verVistaPrevia();
      component.solicitarPublicacion();

      expect(servicio.vistaPrevia).not.toHaveBeenCalled();
      expect(servicio.publicar).not.toHaveBeenCalled();
    });
  });
});
