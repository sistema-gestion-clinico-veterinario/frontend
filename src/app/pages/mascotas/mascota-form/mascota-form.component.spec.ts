import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MascotaFormComponent } from './mascota-form.component';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { FormControl } from '@angular/forms';
import { Subject, of } from 'rxjs';

function createFileInputEvent(file: File): Event {
  const fakeInput = {
    files: { 0: file, length: 1, item: () => file },
    value: '',
  } as unknown as HTMLInputElement;
  return { target: fakeInput } as unknown as Event;
}

describe('MascotaFormComponent', () => {
  let component: MascotaFormComponent;
  let fixture: ComponentFixture<MascotaFormComponent>;
  let addSpy: jasmine.Spy;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MascotaFormComponent, HttpClientTestingModule],
      providers: [
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate', 'navigateByUrl', 'getCurrentNavigation']) },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => null }, queryParamMap: { get: () => null } }, params: of({}), queryParams: of({}) } },
      ],
    })
      .overrideComponent(MascotaFormComponent, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(MascotaFormComponent);
    component = fixture.componentInstance;
    addSpy = spyOn((component as any).messageService, 'add');
  });

  describe('fechaNacimientoValidator', () => {
    it('returns null when the date equals today', () => {
      const today = new Date().toISOString().split('T')[0];
      expect(component.fechaNacimientoValidator(new FormControl(today))).toBeNull();
    });

    it('returns { fechaFutura: true } for a date in the future', () => {
      expect(component.fechaNacimientoValidator(new FormControl('2099-12-31'))).toEqual({ fechaFutura: true });
    });
  });

  describe('onPhotoSelected – validación de tipo de archivo', () => {
    it('muestra advertencia cuando el archivo es PDF (tipo no permitido)', () => {
      component.onPhotoSelected(createFileInputEvent(new File([''], 'doc.pdf', { type: 'application/pdf' })));
      expect(addSpy).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'warn' }));
    });

    it('no muestra advertencia para MIME type válido (image/jpeg)', () => {
      component.onPhotoSelected(createFileInputEvent(new File(['x'], 'photo.jpg', { type: 'image/jpeg' })));
      expect(addSpy).not.toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'warn' }));
    });

    it('no muestra advertencia para extensión .jpe sin MIME type definido', () => {
      component.onPhotoSelected(createFileInputEvent(new File(['x'], 'photo.jpe', { type: '' })));
      expect(addSpy).not.toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'warn' }));
    });
  });
});

describe('MascotaFormComponent - crearCliente validations', () => {
  let component: MascotaFormComponent;
  let fixture: ComponentFixture<MascotaFormComponent>;
  let addSpy: jasmine.Spy;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MascotaFormComponent, HttpClientTestingModule],
      providers: [
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate', 'navigateByUrl', 'getCurrentNavigation']) },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => null }, queryParamMap: { get: () => null } }, params: of({}), queryParams: of({}) } },
      ],
    })
      .overrideComponent(MascotaFormComponent, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(MascotaFormComponent);
    component = fixture.componentInstance;
    addSpy = spyOn((component as any).messageService, 'add');
    component.ncNombre.set('Ana');
    component.ncApellido.set('Perez');
    component.ncTipoDoc.set('DNI');
    component.ncNumDoc.set('1234567');
    component.ncTelefono.set('987654321');
    component.ncCorreo.set('ana@test.com');
    component.ncDireccion.set('Av. Lima 123');
  });

  it('bloquea DNI con longitud invalida antes de llamar al servicio', () => {
    const registrarSpy = spyOn((component as any).apoderadoService, 'registrar');

    component.crearCliente();

    expect(component.ncFieldError('numeroDocumento')).not.toBe('');
    expect(component.ncFieldError('telefono')).toBe('');
    expect(addSpy).toHaveBeenCalledWith(jasmine.objectContaining({
      severity: 'warn',
      summary: 'Revisa los datos del propietario',
    }));
    expect(registrarSpy).not.toHaveBeenCalled();
  });

  it('bloquea telefono que no tiene 9 digitos', () => {
    const registrarSpy = spyOn((component as any).apoderadoService, 'registrar');
    component.ncNumDoc.set('12345678');
    component.ncTelefono.set('98765');

    component.crearCliente();

    expect(component.ncFieldError('telefono')).toBe('Ingresa exactamente 9 dígitos.');
    expect(component.ncFieldError('numeroDocumento')).toBe('');
    expect(addSpy).toHaveBeenCalledWith(jasmine.objectContaining({
      severity: 'warn',
      summary: 'Revisa los datos del propietario',
    }));
    expect(registrarSpy).not.toHaveBeenCalled();
  });

  describe('privacidad al registrar al propietario', () => {
    const aviso = { clinica: 'Clínica Patitas', logoUrl: null, colorPrimario: null,
      audiencia: 'PROPIETARIOS_Y_AUTORIZADOS' as const, version: 3,
      vigenteDesde: '2026-10-05T10:00:00', contenido: 'AVISO' };
    let registrarSpy: jasmine.Spy;

    beforeEach(() => {
      registrarSpy = spyOn((component as any).apoderadoService, 'registrar').and.returnValue(new Subject());
      spyOnProperty(component, 'activeCompanyId', 'get').and.returnValue(1);
      component.ncNumDoc.set('12345678');
      component.avisoPrivacidad.set(aviso);
      component.ncAvisoInformado.set(true);
      component.ncConsentimientoRecordatorios.set(true);
    });

    it('con datos válidos y la privacidad resuelta no muestra aviso de validación y llama al servicio', () => {
      component.crearCliente();

      expect(addSpy).not.toHaveBeenCalledWith(jasmine.objectContaining({ summary: 'Revisa los datos del propietario' }));
      expect(registrarSpy).toHaveBeenCalled();
    });

    it('envía la autorización expresa para recibir recordatorios cuando se marcó', () => {
      component.crearCliente();

      expect(registrarSpy).toHaveBeenCalledWith(jasmine.objectContaining({
        avisoInformado: true, consentimientoRecordatorios: true
      }));
    });

    it('sin aviso publicado por la clínica no registra a nadie y lo explica', () => {
      component.avisoPrivacidad.set(null);

      component.crearCliente();

      expect(registrarSpy).not.toHaveBeenCalled();
      expect(addSpy).toHaveBeenCalledWith(jasmine.objectContaining({
        summary: 'Privacidad pendiente', detail: jasmine.stringMatching(/publicar su aviso/)
      }));
    });

    it('sin confirmar que la persona fue informada no registra', () => {
      component.ncAvisoInformado.set(false);

      component.crearCliente();

      expect(registrarSpy).not.toHaveBeenCalled();
      expect(addSpy).toHaveBeenCalledWith(jasmine.objectContaining({ summary: 'Privacidad pendiente' }));
    });

    it('sin marcar la autorización se registra sin consentimiento para recordatorios', () => {
      component.ncConsentimientoRecordatorios.set(null);

      component.crearCliente();

      expect(registrarSpy).toHaveBeenCalledWith(jasmine.objectContaining({
        avisoInformado: true, consentimientoRecordatorios: null
      }));
    });
  });

  describe('vínculos con la mascota', () => {
    function prepararVinculo(): jasmine.Spy {
      (component as any).mascotaUuid.set('mascota-uuid');
      const crear = spyOn((component as any).mascotaService, 'crearRelacion').and.returnValue(new Subject());
      spyOn((component as any).mascotaService, 'actualizarRelacion').and.returnValue(new Subject());
      return crear;
    }

    it('al vincular se puede indicar desde cuándo y si se le da acceso al portal', () => {
      const crear = prepararVinculo();
      component.abrirNuevaRelacion();
      component.relacionForm.patchValue({
        apoderadoId: 5, tipoRelacion: 'COPROPIETARIO', fechaInicio: '2099-01-10', darAccesoPortal: true
      });

      component.guardarRelacion();

      expect(crear).toHaveBeenCalledWith('mascota-uuid', jasmine.objectContaining({
        apoderadoId: 5, fechaInicio: '2099-01-10', darAccesoPortal: true
      }));
    });

    it('por defecto el vínculo empieza hoy y no ofrece acceso al portal', () => {
      const crear = prepararVinculo();
      component.abrirNuevaRelacion();
      component.relacionForm.patchValue({ apoderadoId: 5, tipoRelacion: 'COPROPIETARIO' });

      component.guardarRelacion();

      expect(crear).toHaveBeenCalledWith('mascota-uuid', jasmine.objectContaining({
        fechaInicio: null, darAccesoPortal: false
      }));
    });

    it('al editar no se vuelve a ofrecer la invitación y un vínculo por empezar sí deja cambiar su inicio', () => {
      prepararVinculo();
      const actualizar = (component as any).mascotaService.actualizarRelacion as jasmine.Spy;
      component.editarRelacion({
        uuid: 'rel-1', apoderadoId: 5, tipoRelacion: 'REPRESENTANTE_AUTORIZADO', activo: false, porEmpezar: true,
        puedeRecibirInformacion: true, puedeAutorizarAtencion: false, puedeRealizarPagos: false,
        fechaInicio: '2099-01-10', fechaFin: null
      } as any);
      expect(component.relacionForm.get('fechaInicio')?.value).toBe('2099-01-10');
      component.relacionForm.patchValue({ darAccesoPortal: true });

      component.guardarRelacion();

      expect(actualizar).toHaveBeenCalledWith('mascota-uuid', 'rel-1', jasmine.objectContaining({ darAccesoPortal: false }));
    });
  });
});
