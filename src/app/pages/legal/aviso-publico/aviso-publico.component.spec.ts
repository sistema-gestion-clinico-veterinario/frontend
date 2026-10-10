import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { AvisoPublicoComponent } from './aviso-publico.component';
import { PrivacidadService } from '../../../core/services/privacidad.service';
import { CompanySlugContext } from '../../../core/services/company-slug-context.service';

describe('AvisoPublicoComponent', () => {
  let fixture: ComponentFixture<AvisoPublicoComponent>;
  let privacidad: jasmine.SpyObj<PrivacidadService>;

  function crear(slug: string | null): void {
    privacidad = jasmine.createSpyObj<PrivacidadService>('PrivacidadService', ['avisoPublico']);
    TestBed.configureTestingModule({
      imports: [AvisoPublicoComponent],
      providers: [
        { provide: PrivacidadService, useValue: privacidad },
        { provide: CompanySlugContext, useValue: { slug: signal(slug).asReadonly() } }
      ]
    });
    fixture = TestBed.createComponent(AvisoPublicoComponent);
  }

  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('muestra el aviso vigente de la clínica de la URL', () => {
    crear('clinica-patitas');
    privacidad.avisoPublico.and.returnValue(of({
      success: true, message: '', data: {
        clinica: 'Clínica Patitas', logoUrl: null, colorPrimario: null,
        audiencia: 'PROPIETARIOS_Y_AUTORIZADOS', version: 2,
        vigenteDesde: '2026-10-05T10:00:00', contenido: 'AVISO DE PRIVACIDAD\n1. Quién trata sus datos'
      }
    } as any));

    fixture.detectChanges();

    expect(privacidad.avisoPublico).toHaveBeenCalledWith('clinica-patitas');
    expect(texto()).toContain('Clínica Patitas');
    expect(texto()).toContain('Versión 2');
    expect(texto()).toContain('1. Quién trata sus datos');
  });

  it('avisa cuando la clínica todavía no publicó su aviso', () => {
    crear('clinica-patitas');
    privacidad.avisoPublico.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));

    fixture.detectChanges();

    expect(texto()).toContain('aún no publicó su aviso de privacidad');
  });

  it('sin clínica en la URL no consulta nada y lo explica', () => {
    crear(null);

    fixture.detectChanges();

    expect(privacidad.avisoPublico).not.toHaveBeenCalled();
    expect(texto()).toContain('No identificamos la clínica');
  });
});
