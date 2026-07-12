import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MascotaFormComponent } from './mascota-form.component';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { FormControl } from '@angular/forms';
import { of } from 'rxjs';

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

    expect(addSpy).toHaveBeenCalledWith(jasmine.objectContaining({
      severity: 'warn',
      summary: 'Documento inválido',
    }));
    expect(registrarSpy).not.toHaveBeenCalled();
  });

  it('bloquea telefono que no tiene 9 digitos', () => {
    const registrarSpy = spyOn((component as any).apoderadoService, 'registrar');
    component.ncNumDoc.set('12345678');
    component.ncTelefono.set('98765');

    component.crearCliente();

    expect(addSpy).toHaveBeenCalledWith(jasmine.objectContaining({
      severity: 'warn',
      summary: 'Teléfono inválido',
    }));
    expect(registrarSpy).not.toHaveBeenCalled();
  });
});
