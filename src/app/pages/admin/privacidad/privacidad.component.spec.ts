import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { PrivacidadComponent } from './privacidad.component';
import { PrivacidadService } from '../../../core/services/privacidad.service';
import { AvisoVersion, CamposAvisoPrivacidad, VistaPreviaAviso } from '../../../models/privacy/privacidad.model';
import { AuthStore } from '../../../store/auth.store';
import { CompanyComplianceService } from '../../../core/services/company-compliance.service';

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
        { provide: CompanyComplianceService, useValue: { actualesDeMiClinica: () => respuesta([
          { control: 'AVISO_PRIVACIDAD', gestionadoPorSoftvet: true }
        ]) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PrivacidadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  describe('administrador de la clínica', () => {
    beforeEach(async () => crear('COMPANY_ADMIN'));

    it('ve el maestro de secciones, el formulario y el historial como tabla', () => {
      expect(servicio.plantilla).toHaveBeenCalled();
      expect(html().querySelector('form')).not.toBeNull();
      expect(texto()).toContain('Revisar y publicar');
      expect(texto()).not.toContain('Vista previa');
      expect(texto()).toContain('Gestión de datos');
      expect(texto()).toContain('Derechos de datos');
      expect(html().querySelector('table')).not.toBeNull();
      expect(texto()).toContain('Administrador de la clínica');

      component.abrirVersion(version());
      fixture.detectChanges();

      expect(texto()).not.toContain('felipe@patitas.test');
      expect(texto()).not.toContain('Dispositivo:');
      expect(texto()).not.toContain('IP 190.40.10.5');
    });

    it('las versiones anteriores a la constancia dicen que no está registrada, sin inventar datos', async () => {
      TestBed.resetTestingModule();
      await crear('COMPANY_ADMIN', [version({ creadoPor: null, creadoDispositivo: null, creadoIp: null })]);
      component.abrirVersion(version({ creadoPor: null, creadoDispositivo: null, creadoIp: null }));
      fixture.detectChanges();

      expect(texto()).toContain('Usuario no registrado');
      expect(texto()).not.toContain('Dispositivo:');
      expect(texto()).not.toContain('· IP');
    });

    it('no abre la revisión final ni publica si faltan datos obligatorios', () => {
      component.form.patchValue({ razonSocial: '' });

      component.solicitarPublicacion();
      fixture.detectChanges();

      expect(servicio.vistaPrevia).not.toHaveBeenCalled();
      expect(servicio.publicar).not.toHaveBeenCalled();
      expect(html().querySelector('[role="dialog"]')).toBeNull();
    });

    it('publicar abre primero la vista previa y solo se publica al confirmarla', () => {
      component.solicitarPublicacion();
      fixture.detectChanges();

      expect(servicio.publicar).not.toHaveBeenCalled();
      expect(html().querySelector('[role="dialog"]')?.textContent).toContain('como la versión 2');
      expect(html().querySelector('[role="dialog"]')?.textContent).toContain('se registrará quién la publicó, cuándo y desde qué dispositivo');

      component.confirmarPublicacion();

      expect(servicio.publicar).toHaveBeenCalledTimes(1);
      expect(servicio.publicar.calls.mostRecent().args[0].ruc).toBe('20123456789');
      expect(servicio.publicar.calls.mostRecent().args[1]).toBeTrue();
      expect(servicio.publicar.calls.mostRecent().args[2]).toBe('PROPIETARIOS_Y_AUTORIZADOS');
    });

    it('con observaciones pendientes o sin cambios, el botón de confirmar está bloqueado y no se publica', () => {
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
      component.solicitarPublicacion();
      fixture.detectChanges();

      component.cerrarVistaPrevia();
      fixture.detectChanges();

      expect(html().querySelector('[role="dialog"]')).toBeNull();
      expect(component.form.controls.domicilio.value).toBe('Jr. Cusco 456');
    });

    it('si no se pudo generar la vista previa, avisa y no abre nada', () => {
      servicio.vistaPrevia.and.returnValue(throwError(() => ({ error: { message: 'Sin permiso' } })));

      component.solicitarPublicacion();
      fixture.detectChanges();

      expect(component.vistaPrevia()).toBeNull();
      expect(component.cargandoVistaPrevia()).toBeFalse();
    });

    it('al publicar se cierra la vista previa y se actualiza el historial', () => {
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
      component.solicitarPublicacion();
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
      expect(texto()).toContain('Solo el administrador de la clínica puede redactar y publicar este aviso');
      expect(html().querySelector('table')).not.toBeNull();
      expect(texto()).toContain('Administrador de la clínica');
      expect(texto()).not.toContain('Publicar nueva versión');
    });

    it('aunque se fuerce desde el código, no se genera vista previa ni se publica', () => {
      component.solicitarPublicacion();

      expect(servicio.vistaPrevia).not.toHaveBeenCalled();
      expect(servicio.publicar).not.toHaveBeenCalled();
    });
  });
});
