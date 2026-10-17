import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';
import { CompanyComplianceComponent } from './company-compliance.component';
import { CompanyComplianceService } from '../../../../core/services/company-compliance.service';
import { CompanyService } from '../../../../core/services/company.service';
import { ConfiguracionCumplimiento } from '../../../../models/privacy/company-compliance.model';

describe('CompanyComplianceComponent', () => {
  let fixture: ComponentFixture<CompanyComplianceComponent>;
  let component: CompanyComplianceComponent;
  let servicio: jasmine.SpyObj<CompanyComplianceService>;

  const respuesta = <T>(data: T) => of({ success: true, message: 'ok', data });
  const html = () => fixture.nativeElement as HTMLElement;
  const texto = () => html().textContent?.replace(/\s+/g, ' ') ?? '';

  const configuracion = (parcial: Partial<ConfiguracionCumplimiento> = {}): ConfiguracionCumplimiento => ({
    control: 'AVISO_PRIVACIDAD', version: 2, habilitado: true, modo: 'SOFTVET', bloqueante: true,
    justificacion: 'Aprobado por el área legal', referenciaContractual: 'Adenda 3', vigenteDesde: null, creadaAt: null,
    configuradaPor: 'plataforma@softvet.test', configuracionExplicita: true, gestionadoPorSoftvet: true, ...parcial
  });

  function crear(lista: ConfiguracionCumplimiento[] = [configuracion()]): void {
    servicio = jasmine.createSpyObj<CompanyComplianceService>('CompanyComplianceService', ['actuales', 'configurar']);
    servicio.actuales.and.returnValue(respuesta(lista));
    servicio.configurar.and.returnValue(respuesta(configuracion()));
    const empresas = jasmine.createSpyObj<CompanyService>('CompanyService', ['getById']);
    empresas.getById.and.returnValue(respuesta({ name: 'Clínica Patitas' }) as never);

    TestBed.configureTestingModule({
      imports: [CompanyComplianceComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '7' }) } } },
        { provide: CompanyComplianceService, useValue: servicio },
        { provide: CompanyService, useValue: empresas }
      ]
    });
    fixture = TestBed.createComponent(CompanyComplianceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  const completar = (control = 'AVISO_PRIVACIDAD' as const, cambios: Record<string, unknown> = {}) =>
    component.formulario(control).patchValue({ justificacion: '  Aprobado por el área legal  ', confirmoRevisionLegal: true, ...cambios });

  it('muestra el nombre de la empresa y cada control con su versión y estado', () => {
    crear([configuracion(), configuracion({ control: 'USO_IA', habilitado: false, modo: 'NO_APLICA', bloqueante: false, configuracionExplicita: false })]);

    expect(component.companyId).toBe(7);
    expect(texto()).toContain('Clínica Patitas');
    expect(texto()).toContain('Aviso de privacidad de la clínica');
    expect(texto()).toContain('Versión 2 · Configuración aprobada');
    expect(texto()).toContain('Uso de inteligencia artificial');
    expect(texto()).toContain('Valor predeterminado del sistema');
    expect(texto()).toContain('No aplica');
  });

  it('si no puede cargar la configuración, muestra el motivo y permite reintentar', () => {
    crear();
    servicio.actuales.and.returnValue(throwError(() => ({ error: { message: 'Solo la plataforma' } })));

    component.cargar();
    fixture.detectChanges();

    expect(texto()).toContain('Solo la plataforma');
    expect(texto()).toContain('Reintentar');
  });

  it('no deja la justificación predeterminada del sistema como si estuviera aprobada', () => {
    crear([configuracion({ configuracionExplicita: false, justificacion: 'Valor por defecto' })]);
    expect(component.formulario('AVISO_PRIVACIDAD').value.justificacion).toBe('');
  });

  it('al deshabilitar un control pasa a «No aplica» y bloquea modo y bloqueo', () => {
    crear();
    const formulario = component.formulario('AVISO_PRIVACIDAD');

    formulario.controls['habilitado'].setValue(false);

    expect(formulario.getRawValue().modo).toBe('NO_APLICA');
    expect(formulario.getRawValue().bloqueante).toBeFalse();
    expect(formulario.controls['modo'].disabled).toBeTrue();
    expect(formulario.controls['bloqueante'].disabled).toBeTrue();
  });

  it('al volver a habilitarlo recupera «Gestionado en SoftVet»', () => {
    crear([configuracion({ habilitado: false, modo: 'NO_APLICA', bloqueante: false })]);
    const formulario = component.formulario('AVISO_PRIVACIDAD');
    expect(formulario.controls['modo'].disabled).toBeTrue();

    formulario.controls['habilitado'].setValue(true);

    expect(formulario.getRawValue().modo).toBe('SOFTVET');
    expect(formulario.controls['modo'].enabled).toBeTrue();
    expect(formulario.controls['bloqueante'].enabled).toBeTrue();
  });

  it('solo la gestión en SoftVet permite bloquear la función relacionada', () => {
    crear();
    const formulario = component.formulario('AVISO_PRIVACIDAD');

    formulario.controls['modo'].setValue('EXTERNO');
    expect(formulario.controls['bloqueante'].disabled).toBeTrue();

    formulario.controls['modo'].setValue('SOFTVET');
    expect(formulario.controls['bloqueante'].enabled).toBeTrue();
  });

  it('los recordatorios por correo no pueden gestionarse externamente', () => {
    crear();
    expect(component.modoNoDisponible('RECORDATORIOS_CORREO', 'EXTERNO')).toBeTrue();
    expect(component.modoNoDisponible('RECORDATORIOS_CORREO', 'SOFTVET')).toBeFalse();
    expect(component.modoNoDisponible('AVISO_PRIVACIDAD', 'EXTERNO')).toBeFalse();
  });

  it('no crea la versión sin justificación válida ni confirmación de revisión legal', () => {
    crear([configuracion({ configuracionExplicita: false })]);

    component.guardar('AVISO_PRIVACIDAD');
    expect(servicio.configurar).not.toHaveBeenCalled();
    expect(component.campoInvalido('AVISO_PRIVACIDAD', 'justificacion')).toBeTrue();

    completar('AVISO_PRIVACIDAD', { justificacion: '   corta   ' });
    component.guardar('AVISO_PRIVACIDAD');
    expect(servicio.configurar).not.toHaveBeenCalled();

    completar('AVISO_PRIVACIDAD', { confirmoRevisionLegal: false });
    component.guardar('AVISO_PRIVACIDAD');
    expect(servicio.configurar).not.toHaveBeenCalled();
  });

  it('crea la versión con los textos sin espacios sobrantes y la referencia vacía como nula', () => {
    crear([configuracion({ referenciaContractual: null })]);
    completar();

    component.guardar('AVISO_PRIVACIDAD');

    expect(servicio.configurar).toHaveBeenCalledWith(7, 'AVISO_PRIVACIDAD', {
      habilitado: true, modo: 'SOFTVET', bloqueante: true, justificacion: 'Aprobado por el área legal',
      referenciaContractual: null, confirmoRevisionLegal: true, vigenteDesde: null
    });
  });

  it('al guardar un control deshabilitado envía «No aplica» y sin bloqueo', () => {
    crear();
    completar();
    component.formulario('AVISO_PRIVACIDAD').controls['habilitado'].setValue(false);

    component.guardar('AVISO_PRIVACIDAD');

    expect(servicio.configurar).toHaveBeenCalledWith(7, 'AVISO_PRIVACIDAD', jasmine.objectContaining({
      habilitado: false, modo: 'NO_APLICA', bloqueante: false
    }));
  });

  it('al guardar vuelve a cargar y avisa', () => {
    crear();
    completar();
    const aviso = spyOn(fixture.debugElement.injector.get(MessageService), 'add');

    component.guardar('AVISO_PRIVACIDAD');

    expect(servicio.actuales).toHaveBeenCalledTimes(2);
    expect(component.guardando()).toBeNull();
    expect(aviso.calls.mostRecent().args[0].severity).toBe('success');
  });

  it('si el servidor rechaza el cambio, muestra su mensaje y conserva lo escrito', () => {
    crear();
    completar();
    servicio.configurar.and.returnValue(throwError(() => ({ error: { message: 'La clínica no existe' } })));
    const aviso = spyOn(fixture.debugElement.injector.get(MessageService), 'add');

    component.guardar('AVISO_PRIVACIDAD');

    expect(aviso.calls.mostRecent().args[0].detail).toBe('La clínica no existe');
    expect(component.formulario('AVISO_PRIVACIDAD').value.justificacion).toBe('  Aprobado por el área legal  ');
    expect(servicio.actuales).toHaveBeenCalledTimes(1);
  });
});
