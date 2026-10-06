import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { AvisoClinicaComponent } from './aviso-clinica.component';
import { PrivacidadService } from '../../../core/services/privacidad.service';
import { AvisoClinicaGate } from '../../../core/services/aviso-clinica-gate.service';
import { AuthStore } from '../../../store/auth.store';

describe('AvisoClinicaComponent', () => {
  let fixture: ComponentFixture<AvisoClinicaComponent>;
  let privacidad: jasmine.SpyObj<PrivacidadService>;
  let gate: jasmine.SpyObj<AvisoClinicaGate>;
  let router: jasmine.SpyObj<Router>;

  const aviso = {
    clinica: 'Clínica Patitas', logoUrl: null, colorPrimario: null, version: 2,
    vigenteDesde: '2026-10-05T10:00:00', contenido: '1. Quién trata sus datos'
  };
  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const boton = () => (fixture.nativeElement as HTMLElement).querySelector('button') as HTMLButtonElement;

  function crear(avisoVigente: any): void {
    privacidad = jasmine.createSpyObj<PrivacidadService>('PrivacidadService', ['avisoVigente', 'leiElAviso']);
    privacidad.avisoVigente.and.returnValue(avisoVigente);
    gate = jasmine.createSpyObj<AvisoClinicaGate>('AvisoClinicaGate', ['marcarVisto']);
    router = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
    TestBed.configureTestingModule({
      imports: [AvisoClinicaComponent],
      providers: [
        { provide: PrivacidadService, useValue: privacidad },
        { provide: AvisoClinicaGate, useValue: gate },
        { provide: Router, useValue: router },
        { provide: AuthStore, useValue: { menu: () => [], activeRolePurpose: () => 'COMPANY_ADMIN' } }
      ]
    });
    fixture = TestBed.createComponent(AvisoClinicaComponent);
    fixture.detectChanges();
  }

  it('muestra el aviso de la clínica sin ninguna casilla, solo el botón para continuar', () => {
    crear(of({ success: true, message: '', data: aviso }));

    expect(texto()).toContain('Aviso de privacidad de Clínica Patitas');
    expect(texto()).toContain('1. Quién trata sus datos');
    expect((fixture.nativeElement as HTMLElement).querySelector('input[type="checkbox"]')).toBeNull();
    expect(boton().textContent).toContain('Entendido, continuar');
  });

  it('al continuar registra que la persona lo vio, marca el aviso como visto y sigue su camino', () => {
    crear(of({ success: true, message: '', data: aviso }));
    privacidad.leiElAviso.and.returnValue(of({ success: true, message: '', data: {} } as any));

    boton().click();

    expect(privacidad.leiElAviso).toHaveBeenCalledTimes(1);
    expect(gate.marcarVisto).toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalled();
  });

  it('si no se pudo registrar, avisa y no deja pasar', () => {
    crear(of({ success: true, message: '', data: aviso }));
    privacidad.leiElAviso.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500, error: { message: 'Falló' } })));

    boton().click();
    fixture.detectChanges();

    expect(texto()).toContain('Falló');
    expect(gate.marcarVisto).not.toHaveBeenCalled();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('si la clínica ya no tiene aviso vigente no retiene a la persona', () => {
    crear(of({ success: true, message: '', data: null }));

    expect(gate.marcarVisto).toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalled();
  });
});
