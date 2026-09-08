import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { LegalAcceptComponent } from './legal-accept.component';
import { LegalService } from '../../../core/services/legal.service';
import { AuthService } from '../../../core/services/auth.service';
import { AuthStore } from '../../../store/auth.store';

describe('LegalAcceptComponent', () => {
  let component: LegalAcceptComponent;
  let fixture: ComponentFixture<LegalAcceptComponent>;
  let legalService: jasmine.SpyObj<LegalService>;

  const pendingDocuments = [
    { id: 1, tipo: 'TERMINOS_Y_CONDICIONES' as const, version: '1.0', contenido: 'Texto de términos', vigenteDesde: '2026-01-01' },
    { id: 2, tipo: 'POLITICA_PRIVACIDAD' as const, version: '1.0', contenido: 'Texto de privacidad', vigenteDesde: '2026-01-01' },
  ];

  beforeEach(async () => {
    legalService = jasmine.createSpyObj('LegalService', ['getStatus', 'accept']);
    legalService.getStatus.and.returnValue(of({
      success: true,
      message: '',
      data: { needsAcceptance: true, overdue: true, pendingDocuments }
    }));

    await TestBed.configureTestingModule({
      imports: [LegalAcceptComponent],
      providers: [
        { provide: LegalService, useValue: legalService },
        { provide: AuthService, useValue: jasmine.createSpyObj('AuthService', ['logout']) },
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigateByUrl']) },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LegalAcceptComponent);
    component = fixture.componentInstance;
    TestBed.inject(AuthStore).logout();
    fixture.detectChanges();
  });

  function nextButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('button.btn-solid') as HTMLButtonElement;
  }

  function currentCheckbox(): HTMLInputElement {
    return fixture.nativeElement.querySelector('input[type="checkbox"]') as HTMLInputElement;
  }

  it('muestra un solo documento a la vez, empezando por el primero', () => {
    expect(component.documents().length).toBe(2);
    expect(component.currentIndex()).toBe(0);
    expect(component.currentDoc()?.id).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('input[type="checkbox"]').length).toBe(1);
  });

  it('el botón permanece deshabilitado hasta marcar el checkbox del documento actual', () => {
    expect(component.currentChecked()).toBeFalse();
    expect(nextButton().disabled).toBeTrue();
  });

  it('marcar el checkbox habilita "Continuar" (no es el último documento)', () => {
    component.toggleCurrent(true);
    fixture.detectChanges();

    expect(nextButton().disabled).toBeFalse();
    expect(nextButton().textContent).toContain('Continuar');
    expect(nextButton().textContent).not.toContain('Aceptar y continuar');
  });

  it('al presionar Continuar avanza al segundo documento y el checkbox se resetea a ese documento', () => {
    component.toggleCurrent(true);
    fixture.detectChanges();
    nextButton().click();
    fixture.detectChanges();

    expect(component.currentIndex()).toBe(1);
    expect(component.currentDoc()?.id).toBe(2);
    expect(component.currentChecked()).toBeFalse();
    expect(nextButton().disabled).toBeTrue();
  });

  it('en el último documento el botón dice "Aceptar y continuar" y al marcarlo se habilita', () => {
    component.toggleCurrent(true);
    fixture.detectChanges();
    nextButton().click();
    fixture.detectChanges();

    expect(nextButton().textContent).toContain('Aceptar y continuar');
    expect(nextButton().disabled).toBeTrue();

    component.toggleCurrent(true);
    fixture.detectChanges();
    expect(nextButton().disabled).toBeFalse();
  });

  it('al terminar el último documento llama a accept() con los ids de ambos documentos', () => {
    legalService.accept.and.returnValue(of({ success: true, message: '', data: undefined }));
    component.toggleCurrent(true);
    fixture.detectChanges();
    nextButton().click();
    fixture.detectChanges();
    component.toggleCurrent(true);
    fixture.detectChanges();

    nextButton().click();

    expect(legalService.accept).toHaveBeenCalledWith([1, 2]);
  });

  it('el botón "Atrás" no aparece en el primer documento pero sí en el segundo', () => {
    expect(fixture.nativeElement.textContent).not.toContain('Atrás');

    component.toggleCurrent(true);
    fixture.detectChanges();
    nextButton().click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Atrás');
  });

  it('marcar el checkbox real desde el DOM (click del usuario) también habilita el botón', () => {
    const checkbox = currentCheckbox();
    checkbox.click();
    checkbox.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(component.currentChecked()).toBeTrue();
    expect(nextButton().disabled).toBeFalse();
  });
});
