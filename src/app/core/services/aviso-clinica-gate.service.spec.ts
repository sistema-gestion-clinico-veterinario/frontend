import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
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

  it('varias rutas anidadas que preguntan a la vez comparten una sola consulta', () => {
    const respuesta = new Subject<any>();
    privacidad.miEstado.and.returnValue(respuesta);
    const gate = TestBed.inject(AvisoClinicaGate);
    const valores: boolean[] = [];

    for (let i = 0; i < 6; i++) gate.debeMostrarse().subscribe(v => valores.push(v));
    respuesta.next({ success: true, message: '', data: { avisoPublicado: true, vistaPorLaPersona: false } });
    respuesta.complete();

    expect(privacidad.miEstado).toHaveBeenCalledTimes(1);
    expect(valores).toEqual([true, true, true, true, true, true]);
  });

  it('terminada la consulta, la siguiente navegación vuelve a preguntar mientras el aviso siga pendiente', () => {
    privacidad.miEstado.and.returnValue(estado({}));
    const gate = TestBed.inject(AvisoClinicaGate);

    expect(resultado(gate)).toBeTrue();
    expect(resultado(gate)).toBeTrue();

    expect(privacidad.miEstado).toHaveBeenCalledTimes(2);
  });

  it('si la consulta falla envía a la pantalla segura y se puede volver a intentar', () => {
    privacidad.miEstado.and.returnValues(throwError(() => new HttpErrorResponse({ status: 429 })), estado({}));
    const gate = TestBed.inject(AvisoClinicaGate);

    expect(resultado(gate)).toBeTrue();
    expect(resultado(gate)).toBeTrue();
  });

  it('sin aviso publicado no se muestra', () => {
    privacidad.miEstado.and.returnValue(estado({ avisoPublicado: false }));

    expect(resultado(TestBed.inject(AvisoClinicaGate))).toBeFalse();
  });

  it('si la consulta falla bloquea el ingreso de forma segura', () => {
    privacidad.miEstado.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

    expect(resultado(TestBed.inject(AvisoClinicaGate))).toBeTrue();
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
