import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProfileComponent } from './profile.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { LegalAcceptanceDTO, LegalService } from '../../core/services/legal.service';

describe('ProfileComponent', () => {
  let component: ProfileComponent;
  let fixture: ComponentFixture<ProfileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileComponent, HttpClientTestingModule],
    })
    .overrideComponent(ProfileComponent, { set: { template: '' } })
    .compileComponents();

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('documentos legales aceptados', () => {
    const aceptacion = (parcial: Partial<LegalAcceptanceDTO> = {}): LegalAcceptanceDTO => ({
      tipo: 'TERMINOS_Y_CONDICIONES', version: '2.0', contenidoHash: 'abc', textoRecuperable: true,
      fechaAceptacion: '2026-10-04T20:00:00', ...parcial
    });

    it('muestra las aceptaciones de la persona tal como las devuelve el servidor', () => {
      const servicio = TestBed.inject(LegalService);
      spyOn(servicio, 'getMyAcceptances').and.returnValue(of({
        success: true, message: 'ok',
        data: [aceptacion(), aceptacion({ tipo: 'POLITICA_PRIVACIDAD', version: '1.0', contenidoHash: null, textoRecuperable: false })]
      }));

      component.loadLegalAcceptances();

      expect(component.legalAcceptances().length).toBe(2);
      expect(component.legalAcceptances()[1].textoRecuperable).toBeFalse();
    });

    it('si el historial no se puede cargar, el perfil sigue funcionando sin ese bloque', () => {
      const servicio = TestBed.inject(LegalService);
      spyOn(servicio, 'getMyAcceptances').and.returnValue(throwError(() => ({ status: 500 })));
      component.legalAcceptances.set([aceptacion()]);

      component.loadLegalAcceptances();

      expect(component.legalAcceptances()).toEqual([]);
    });

    it('nombra cada documento', () => {
      expect(component.legalLabel('TERMINOS_Y_CONDICIONES')).toBe('Términos y Condiciones');
      expect(component.legalLabel('POLITICA_PRIVACIDAD')).toBe('Política de privacidad de la plataforma');
    });
  });

  describe('autorización del uso de IA', () => {
    const estado = (estadoIa?: 'OTORGADO' | 'RETIRADO') => ({
      avisoPublicado: true, avisoVersion: 1, informada: true, informadaVersion: 1, informadaFecha: null, informadaCanal: null,
      vistaPorLaPersona: true,
      finalidades: [
        { codigo: 'RECORDATORIOS_PREVENTIVOS', descripcion: 'x', estado: 'OTORGADO', fecha: null, canal: null },
        ...(estadoIa ? [{ codigo: 'USO_IA_CLINICA', descripcion: 'IA', estado: estadoIa, fecha: null, canal: null }] : [])
      ]
    }) as any;

    it('por defecto no hay autorización', () => {
      component.estadoPrivacidad.set(estado());

      expect(component.estadoIa()).toBe('SIN_REGISTRO');
    });

    it('autorizar y retirar se registran como decisiones separadas de los recordatorios', () => {
      const servicio = (component as any).privacidadService;
      const decidir = spyOn(servicio, 'decidir').and.returnValues(
        of({ success: true, message: 'ok', data: estado('OTORGADO') }),
        of({ success: true, message: 'ok', data: estado('RETIRADO') }));

      component.decidirIa(true);
      expect(decidir).toHaveBeenCalledWith('USO_IA_CLINICA', true);
      expect(component.estadoIa()).toBe('OTORGADO');

      component.decidirIa(false);
      expect(decidir).toHaveBeenCalledWith('USO_IA_CLINICA', false);
      expect(component.estadoIa()).toBe('RETIRADO');
    });

    it('al decidir sobre la IA o confirmar la lectura, la tarjeta de pendientes se actualiza', () => {
      const servicio = (component as any).privacidadService;
      spyOn(servicio, 'decidir').and.returnValue(of({ success: true, message: 'ok', data: estado('OTORGADO') }));
      spyOn(servicio, 'leiElAviso').and.returnValue(of({ success: true, message: 'ok', data: estado('OTORGADO') }));
      const refrescar = spyOn((component as any).pendientesPrivacidad, 'refrescar');

      component.decidirIa(true);
      expect(refrescar).toHaveBeenCalledTimes(1);

      component.registrarLecturaAviso();
      expect(refrescar).toHaveBeenCalledTimes(2);
    });

    it('si no se pudo guardar, avisa y no cambia el estado', () => {
      const servicio = (component as any).privacidadService;
      component.estadoPrivacidad.set(estado());
      spyOn(servicio, 'decidir').and.returnValue(throwError(() => ({ error: { message: 'La clínica aún no publicó su aviso' } })));
      const aviso = spyOn((component as any).messageService, 'add');

      component.decidirIa(true);

      expect(component.estadoIa()).toBe('SIN_REGISTRO');
      expect(component.actualizandoPrivacidad()).toBeFalse();
      expect(aviso).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error' }));
    });
  });
});
