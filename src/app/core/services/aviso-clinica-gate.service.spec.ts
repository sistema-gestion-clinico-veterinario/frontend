import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { AvisoClinicaGate } from './aviso-clinica-gate.service';
import { PrivacidadService } from './privacidad.service';
import { AuthStore } from '../../store/auth.store';

describe('AvisoClinicaGate', () => {
  let privacidad: jasmine.SpyObj<PrivacidadService>;
  let companyId: number | null;

  const estado = (parcial: object) => of({ success: true, message: '', data: { avisoPublicado: true, vistaPorLaPersona: false, ...parcial } } as any);
  const resultado = (gate: AvisoClinicaGate) => {
    let valor: boolean | undefined;
    gate.debeMostrarse().subscribe((v) => (valor = v));
    return valor;
  };

  beforeEach(() => {
    companyId = 7;
    privacidad = jasmine.createSpyObj<PrivacidadService>('PrivacidadService', ['miEstado']);
    TestBed.configureTestingModule({
      providers: [
        { provide: PrivacidadService, useValue: privacidad },
        { provide: AuthStore, useValue: { companyId: () => companyId, activeRoleId: () => 3, nombreCompleto: () => 'Ana Pruebas' } }
      ]
    });
  });

  it('quien no pertenece a una clínica (administrador de la plataforma) nunca lo ve ni consulta nada', () => {
    companyId = null;
    const gate = TestBed.inject(AvisoClinicaGate);

    expect(resultado(gate)).toBeFalse();
    expect(privacidad.miEstado).not.toHaveBeenCalled();
  });

  it('se muestra cuando la clínica tiene aviso y la persona todavía no lo vio', () => {
    privacidad.miEstado.and.returnValue(estado({}));

    expect(resultado(TestBed.inject(AvisoClinicaGate))).toBeTrue();
  });

  it('si recepción la registró pero ella no lo vio, igual se muestra', () => {
    privacidad.miEstado.and.returnValue(estado({ informada: true, informadaCanal: 'PRESENCIAL', vistaPorLaPersona: false }));

    expect(resultado(TestBed.inject(AvisoClinicaGate))).toBeTrue();
  });

  it('no se muestra si la clínica no publicó aviso ni si la persona ya lo vio, y no consulta de nuevo', () => {
    const gate = TestBed.inject(AvisoClinicaGate);
    privacidad.miEstado.and.returnValue(estado({ vistaPorLaPersona: true }));
    expect(resultado(gate)).toBeFalse();

    expect(resultado(gate)).toBeFalse();
    expect(privacidad.miEstado).toHaveBeenCalledTimes(1);
  });

  it('sin aviso publicado no se muestra', () => {
    privacidad.miEstado.and.returnValue(estado({ avisoPublicado: false }));

    expect(resultado(TestBed.inject(AvisoClinicaGate))).toBeFalse();
  });

  it('si la consulta falla no bloquea el ingreso', () => {
    privacidad.miEstado.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

    expect(resultado(TestBed.inject(AvisoClinicaGate))).toBeFalse();
  });

  it('al confirmar, deja de mostrarse sin volver a consultar', () => {
    const gate = TestBed.inject(AvisoClinicaGate);
    privacidad.miEstado.and.returnValue(estado({}));
    expect(resultado(gate)).toBeTrue();

    gate.marcarVisto();

    expect(resultado(gate)).toBeFalse();
    expect(privacidad.miEstado).toHaveBeenCalledTimes(1);
  });
});
