import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AvisoPublicoComponent } from './aviso-publico.component';
import { PrivacidadService } from '../../../core/services/privacidad.service';
import { CompanySlugContext } from '../../../core/services/company-slug-context.service';

describe('AvisoPublicoComponent', () => {
  let fixture: ComponentFixture<AvisoPublicoComponent>;
  let component: AvisoPublicoComponent;
  let privacidad: jasmine.SpyObj<PrivacidadService>;
  let router: jasmine.SpyObj<Router>;

  function crear(slug: string | null, parametros: Record<string, string> = {}): void {
    privacidad = jasmine.createSpyObj<PrivacidadService>('PrivacidadService', ['centroLegalPublico']);
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    TestBed.configureTestingModule({
      imports: [AvisoPublicoComponent],
      providers: [
        { provide: PrivacidadService, useValue: privacidad },
        { provide: CompanySlugContext, useValue: { slug: signal(slug).asReadonly() } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(parametros) } } },
        { provide: Router, useValue: router }
      ]
    });
    fixture = TestBed.createComponent(AvisoPublicoComponent);
    component = fixture.componentInstance;
  }

  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  const centro = () => of({
    success: true, message: '', data: {
      clinica: 'Clínica Patitas', logoUrl: null, colorPrimario: '#0891b2',
      documentos: [
        { codigo: 'AVISO_PRIVACIDAD' as const, titulo: 'Aviso de privacidad', version: '2',
          vigenteDesde: '2026-10-05T10:00:00', contenido: '1. Quién trata sus datos' },
        { codigo: 'TERMINOS_Y_CONDICIONES' as const, titulo: 'Términos y condiciones', version: '1.0',
          vigenteDesde: '2026-10-01T10:00:00', contenido: 'Condiciones de uso' },
        { codigo: 'POLITICA_PRIVACIDAD' as const, titulo: 'Política de privacidad de SoftVet', version: '1.1',
          vigenteDesde: '2026-10-02T10:00:00', contenido: 'Política de la plataforma' }
      ]
    }
  });

  it('carga todos los documentos una sola vez y muestra el aviso por defecto', () => {
    crear('clinica-patitas');
    privacidad.centroLegalPublico.and.returnValue(centro());
    fixture.detectChanges();

    expect(privacidad.centroLegalPublico).toHaveBeenCalledOnceWith(
      'clinica-patitas', 'PROPIETARIOS_Y_AUTORIZADOS', undefined);
    expect(texto()).toContain('Clínica Patitas');
    expect(texto()).toContain('Versión 2');
    expect(texto()).toContain('1. Quién trata sus datos');
  });

  it('cambia de documento al instante sin hacer otra petición', () => {
    crear('clinica-patitas');
    privacidad.centroLegalPublico.and.returnValue(centro());
    fixture.detectChanges();

    component.seleccionar('TERMINOS_Y_CONDICIONES');
    fixture.detectChanges();

    expect(texto()).toContain('Condiciones de uso');
    expect(privacidad.centroLegalPublico).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: { documento: 'TERMINOS_Y_CONDICIONES' }, replaceUrl: true
    }));
  });

  it('abre directamente el documento indicado por la URL', () => {
    crear('clinica-patitas', { documento: 'POLITICA_PRIVACIDAD' });
    privacidad.centroLegalPublico.and.returnValue(centro());
    fixture.detectChanges();

    expect(texto()).toContain('Política de la plataforma');
  });

  it('pide en la misma carga el aviso de trabajadores y una versión histórica', () => {
    crear('clinica-patitas', { audiencia: 'TRABAJADORES_Y_USUARIOS', version: '1' });
    privacidad.centroLegalPublico.and.returnValue(centro());
    fixture.detectChanges();

    expect(privacidad.centroLegalPublico).toHaveBeenCalledWith(
      'clinica-patitas', 'TRABAJADORES_Y_USUARIOS', 1);
  });

  it('ignora una versión que no es un entero positivo', () => {
    crear('clinica-patitas', { version: '-3' });
    privacidad.centroLegalPublico.and.returnValue(centro());
    fixture.detectChanges();

    expect(privacidad.centroLegalPublico).toHaveBeenCalledWith(
      'clinica-patitas', 'PROPIETARIOS_Y_AUTORIZADOS', undefined);
  });

  it('avisa cuando la clínica todavía no publicó documentos', () => {
    crear('clinica-patitas');
    privacidad.centroLegalPublico.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 404 })));
    fixture.detectChanges();

    expect(texto()).toContain('aún no publicó sus documentos legales');
  });

  it('sin clínica en la URL no consulta nada y lo explica', () => {
    crear(null);
    fixture.detectChanges();

    expect(privacidad.centroLegalPublico).not.toHaveBeenCalled();
    expect(texto()).toContain('No identificamos la clínica');
  });
});
