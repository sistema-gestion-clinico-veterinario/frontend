import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AvisoPublicoComponent } from './aviso-publico.component';
import { PrivacidadService } from '../../../core/services/privacidad.service';
import { CompanySlugContext } from '../../../core/services/company-slug-context.service';

describe('AvisoPublicoComponent', () => {
  let fixture: ComponentFixture<AvisoPublicoComponent>;
  let privacidad: jasmine.SpyObj<PrivacidadService>;

  function crear(slug: string | null, parametros: Record<string, string> = {}): void {
    privacidad = jasmine.createSpyObj<PrivacidadService>('PrivacidadService', ['avisoPublico', 'avisoPublicoVersion']);
    TestBed.configureTestingModule({
      imports: [AvisoPublicoComponent],
      providers: [
        { provide: PrivacidadService, useValue: privacidad },
        { provide: CompanySlugContext, useValue: { slug: signal(slug).asReadonly() } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(parametros) } } }
      ]
    });
    fixture = TestBed.createComponent(AvisoPublicoComponent);
  }

  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  const aviso = (parcial: Record<string, unknown> = {}) => of({
    success: true, message: '', data: {
      clinica: 'Clínica Patitas', logoUrl: null, colorPrimario: null,
      audiencia: 'PROPIETARIOS_Y_AUTORIZADOS', version: 2,
      vigenteDesde: '2026-10-05T10:00:00', contenido: 'AVISO DE PRIVACIDAD\n1. Quién trata sus datos', ...parcial
    }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  it('muestra el aviso vigente de la clínica de la URL', () => {
    crear('clinica-patitas');
    privacidad.avisoPublico.and.returnValue(aviso());

    fixture.detectChanges();

    expect(privacidad.avisoPublico).toHaveBeenCalledWith('clinica-patitas', 'PROPIETARIOS_Y_AUTORIZADOS');
    expect(texto()).toContain('Clínica Patitas');
    expect(texto()).toContain('Versión 2');
    expect(texto()).toContain('1. Quién trata sus datos');
  });

  it('pide el aviso de trabajadores cuando el enlace lo indica', () => {
    crear('clinica-patitas', { audiencia: 'TRABAJADORES_Y_USUARIOS' });
    privacidad.avisoPublico.and.returnValue(aviso({ audiencia: 'TRABAJADORES_Y_USUARIOS' }));

    fixture.detectChanges();

    expect(privacidad.avisoPublico).toHaveBeenCalledWith('clinica-patitas', 'TRABAJADORES_Y_USUARIOS');
  });

  it('cualquier otra audiencia en el enlace se trata como la de propietarios', () => {
    crear('clinica-patitas', { audiencia: 'OTRA' });
    privacidad.avisoPublico.and.returnValue(aviso());

    fixture.detectChanges();

    expect(privacidad.avisoPublico).toHaveBeenCalledWith('clinica-patitas', 'PROPIETARIOS_Y_AUTORIZADOS');
  });

  it('con una versión en el enlace muestra esa versión y no la vigente', () => {
    crear('clinica-patitas', { version: '1', audiencia: 'TRABAJADORES_Y_USUARIOS' });
    privacidad.avisoPublicoVersion.and.returnValue(aviso({ version: 1 }));

    fixture.detectChanges();

    expect(privacidad.avisoPublicoVersion).toHaveBeenCalledWith('clinica-patitas', 1, 'TRABAJADORES_Y_USUARIOS');
    expect(privacidad.avisoPublico).not.toHaveBeenCalled();
    expect(texto()).toContain('Versión 1');
  });

  it('ignora una versión que no es un entero positivo', () => {
    crear('clinica-patitas', { version: '-3' });
    privacidad.avisoPublico.and.returnValue(aviso());

    fixture.detectChanges();

    expect(privacidad.avisoPublicoVersion).not.toHaveBeenCalled();
    expect(privacidad.avisoPublico).toHaveBeenCalled();
  });

  it('avisa cuando la clínica todavía no publicó su aviso', () => {
    crear('clinica-patitas');
    privacidad.avisoPublico.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));

    fixture.detectChanges();

    expect(texto()).toContain('aún no publicó su aviso de privacidad');
  });

  it('ante otro error pide intentar nuevamente', () => {
    crear('clinica-patitas');
    privacidad.avisoPublico.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

    fixture.detectChanges();

    expect(texto()).toContain('No se pudo cargar el aviso de privacidad');
  });

  it('sin clínica en la URL no consulta nada y lo explica', () => {
    crear(null);

    fixture.detectChanges();

    expect(privacidad.avisoPublico).not.toHaveBeenCalled();
    expect(texto()).toContain('No identificamos la clínica');
  });
});
