import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProfileComponent } from './profile.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { LegalAcceptanceDTO, LegalService } from '../../core/services/legal.service';

describe('ProfileComponent', () => {
  let component: ProfileComponent;
  let fixture: ComponentFixture<ProfileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileComponent, HttpClientTestingModule],
    })
    .overrideComponent(ProfileComponent, { set: { template: '' } })
    .compileComponents();

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('documentos legales aceptados', () => {
    const aceptacion = (parcial: Partial<LegalAcceptanceDTO> = {}): LegalAcceptanceDTO => ({
      tipo: 'TERMINOS_Y_CONDICIONES', version: '2.0', contenidoHash: 'abc', textoRecuperable: true,
      fechaAceptacion: '2026-10-04T20:00:00', ...parcial
    });

    it('muestra las aceptaciones de la persona tal como las devuelve el servidor', () => {
      const servicio = TestBed.inject(LegalService);
      spyOn(servicio, 'getMyAcceptances').and.returnValue(of({
        success: true, message: 'ok',
        data: [aceptacion(), aceptacion({ tipo: 'POLITICA_PRIVACIDAD', version: '1.0', contenidoHash: null, textoRecuperable: false })]
      }));

      component.loadLegalAcceptances();

      expect(component.legalAcceptances().length).toBe(2);
      expect(component.legalAcceptances()[1].textoRecuperable).toBeFalse();
    });

    it('si el historial no se puede cargar, el perfil sigue funcionando sin ese bloque', () => {
      const servicio = TestBed.inject(LegalService);
      spyOn(servicio, 'getMyAcceptances').and.returnValue(throwError(() => ({ status: 500 })));
      component.legalAcceptances.set([aceptacion()]);

      component.loadLegalAcceptances();

      expect(component.legalAcceptances()).toEqual([]);
    });

    it('nombra cada documento', () => {
      expect(component.legalLabel('TERMINOS_Y_CONDICIONES')).toBe('Términos y Condiciones');
      expect(component.legalLabel('POLITICA_PRIVACIDAD')).toBe('Política de Privacidad');
    });
  });
});
