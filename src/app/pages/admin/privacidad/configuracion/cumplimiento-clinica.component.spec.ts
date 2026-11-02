import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CompanyComplianceService } from '../../../../core/services/company-compliance.service';
import { LegalService } from '../../../../core/services/legal.service';
import { CumplimientoClinicaComponent } from './cumplimiento-clinica.component';

describe('CumplimientoClinicaComponent', () => {
  let fixture: ComponentFixture<CumplimientoClinicaComponent>;
  let compliance: jasmine.SpyObj<CompanyComplianceService>;
  const respuesta = <T>(data: T) => of({ success: true, message: 'ok', data });

  beforeEach(async () => {
    compliance = jasmine.createSpyObj('CompanyComplianceService', [
      'detalleDeMiClinica', 'solicitudesDeMiClinica', 'solicitarCambio'
    ]);
    compliance.detalleDeMiClinica.and.returnValue(respuesta([{
      control: 'AVISO_PRIVACIDAD', version: 1, habilitado: true, modo: 'SOFTVET', bloqueante: true,
      gestionadoPorSoftvet: true, justificacion: 'Configuración aprobada', referenciaContractual: null,
      configuradaPor: 'Plataforma', configuracionExplicita: true
    }]));
    compliance.solicitudesDeMiClinica.and.returnValue(respuesta([]));
    const legal = jasmine.createSpyObj<LegalService>('LegalService', ['getCurrentDocuments']);
    legal.getCurrentDocuments.and.returnValue(respuesta([{
      id: 1, tipo: 'TERMINOS_Y_CONDICIONES', version: '2.0', contenido: 'Términos', vigenteDesde: '2026-10-01'
    }]));

    await TestBed.configureTestingModule({
      imports: [CumplimientoClinicaComponent],
      providers: [provideRouter([]), { provide: CompanyComplianceService, useValue: compliance }, { provide: LegalService, useValue: legal }]
    }).compileComponents();
    fixture = TestBed.createComponent(CumplimientoClinicaComponent);
    fixture.detectChanges();
  });

  it('distingue documentos globales de controles configurables', () => {
    const texto = fixture.nativeElement.textContent.replace(/\s+/g, ' ');
    expect(texto).toContain('Términos y Condiciones de SoftVet');
    expect(texto).toContain('no pueden desactivarse');
    expect(texto).toContain('Aviso de privacidad de la clínica');
    expect(texto).toContain('Solicitar cambio');
  });
});
