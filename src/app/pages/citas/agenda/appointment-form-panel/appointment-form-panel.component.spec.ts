import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { AppointmentFormPanelComponent } from './appointment-form-panel.component';

describe('AppointmentFormPanelComponent', () => {
  let fixture: ComponentFixture<AppointmentFormPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AppointmentFormPanelComponent] }).compileComponents();
    fixture = TestBed.createComponent(AppointmentFormPanelComponent);

    const fb = TestBed.inject(FormBuilder);
    const arraySignal = signal<any[]>([]);
    const falseSignal = signal(false);
    const nullSignal = signal<any>(null);
    const textSignal = signal('');
    const context = new Proxy({
      displayModal: signal(true),
      citaForm: fb.group({
        id: [null], mascotaId: [null], veterinarioId: [null], servicioId: [null],
        fechaCita: [null], horaCita: [null], fechaHoraInicio: [null],
        motivoCita: [''], notas: [''], esEmergencia: [false]
      }),
      today: new Date(2026, 9, 12),
      loadingStore: { isLoading: () => false },
      horariosResumen: [],
      selectedClienteLabel: signal('Seleccionar dueño...'),
      selectedMascotaLabel: signal('Seleccionar mascota...')
    } as Record<string, any>, {
      get(target, property: string) {
        if (property in target) return target[property];
        if (['filteredClientes', 'filteredMascotas', 'razasAgenda', 'servicios', 'empleadosDelServicio',
          'controlesParaServicio', 'availableSlots'].includes(property)) return arraySignal;
        if (property.startsWith('show') || property.startsWith('saving') || property.startsWith('is') || property === 'canBookEmergency') return falseSignal;
        if (property.startsWith('selected') || property.startsWith('nmRaza')) return nullSignal;
        if (property.startsWith('nc') || property.startsWith('nm') || property.endsWith('Label')) return textSignal;
        if (property === 'toDateStr') return () => '2026-10-12';
        if (property.startsWith('get')) return () => 'Seleccionar...';
        return () => undefined;
      }
    });

    fixture.componentRef.setInput('context', context as any);
    fixture.detectChanges();
  });

  it('conserva el panel lateral y el formulario original de citas', () => {
    const panel = fixture.nativeElement.querySelector('.sm\\:w-\\[520px\\]');
    const form = fixture.nativeElement.querySelector('#citaSidebarForm');

    expect(panel).not.toBeNull();
    expect(form).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Nueva Cita Médica');
  });
});
