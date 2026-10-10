import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CompanyComponent } from './company.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MessageService } from 'primeng/api';
import { ReactiveFormsModule } from '@angular/forms';
import { of } from 'rxjs';

describe('CompanyComponent', () => {
  let component: CompanyComponent;
  let fixture: ComponentFixture<CompanyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompanyComponent, HttpClientTestingModule, ReactiveFormsModule],
      providers: [MessageService]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CompanyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('URL de acceso (slug)', () => {
    const datos = { id: 1, name: 'Clínica Patitas', slug: 'patitas', operatingHours: [] } as any;
    let comoPlataforma: boolean;

    const abrirEdicion = () => {
      (component as any).isSuperAdmin = () => comoPlataforma;
      spyOn((component as any).companyService, 'getById').and.returnValue(of({ success: true, message: 'ok', data: datos }));
      component.editCompany({ id: 1 } as any);
      fixture.detectChanges();
    };
    const campo = () => (fixture.nativeElement as HTMLElement).querySelector('input[formControlName="slug"]') as HTMLInputElement | null;
    const texto = () => (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ') ?? '';

    it('la clínica ve su URL pero no puede editarla, y no se envía al guardar', () => {
      comoPlataforma = false;

      abrirEdicion();

      const slug = component.companyForm.get('slug')!;
      expect(slug.disabled).toBeTrue();
      expect(slug.value).toBe('patitas');
      expect(component.companyForm.getRawValue().slug).toBe('patitas');
      expect(campo()?.disabled).toBeTrue();
      expect(texto()).toContain('Solo el administrador de la plataforma puede cambiar esta dirección');
      expect(texto()).not.toContain('Cambiarlo invalida');
    });

    it('al guardar, la clínica envía su URL actual sin cambios, porque el servidor la exige', () => {
      comoPlataforma = false;
      abrirEdicion();
      const actualizar = spyOn((component as any).companyService, 'updateCompany') as unknown as jasmine.Spy;
      actualizar.and.returnValue(of({ success: true, message: 'ok', data: { id: 1 } }));
      spyOn(component, 'loadOwnCompany');
      component.companyForm.patchValue({ name: 'Clínica Patitas', ruc: '20123456789', phone: '987654321', email: 'a@b.pe', address: 'Av. Siempre Viva 123' });
      component.companyForm.markAsDirty();

      (component as any).confirmSaveCompany(component.companyForm.getRawValue());

      expect(actualizar).toHaveBeenCalledTimes(1);
      expect(actualizar.calls.mostRecent().args[0].slug).toBe('patitas');
    });

    it('el administrador de la plataforma sí puede editarla y se avisa del efecto', () => {
      comoPlataforma = true;

      abrirEdicion();
      component.companyForm.get('slug')!.setValue('url-nueva');
      fixture.detectChanges();

      expect(component.companyForm.get('slug')!.enabled).toBeTrue();
      expect(campo()?.disabled).toBeFalse();
      expect(texto()).not.toContain('Solo el administrador de la plataforma puede cambiar esta dirección');
      expect(texto()).toContain('Cambiarlo invalida los enlaces de acceso');
    });

    it('al registrar una empresa nueva el campo vuelve a estar disponible', () => {
      comoPlataforma = false;
      abrirEdicion();
      expect(component.companyForm.get('slug')!.disabled).toBeTrue();

      component.openNew();

      expect(component.companyForm.get('slug')!.enabled).toBeTrue();
    });
  });
});
