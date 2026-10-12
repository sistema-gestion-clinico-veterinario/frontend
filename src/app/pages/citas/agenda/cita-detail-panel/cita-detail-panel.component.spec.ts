import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CitaDetailPanelComponent } from './cita-detail-panel.component';

describe('CitaDetailPanelComponent', () => {
  let fixture: ComponentFixture<CitaDetailPanelComponent>;
  let component: CitaDetailPanelComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CitaDetailPanelComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(CitaDetailPanelComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('cita', {
      id: 10,
      mascotaNombre: 'Luna',
      apoderadoNombre: 'Ana Perez',
      veterinarioNombre: 'Dr. Ruiz',
      estado: 'PROGRAMADA',
      fechaHoraInicio: '2026-10-12T10:00:00',
      fechaHoraFin: '2026-10-12T10:30:00',
      duracionMinutos: 30,
      motivoCita: 'Control general',
      esEmergencia: false
    } as any);
    fixture.componentRef.setInput('statusLabel', 'Programada');
    fixture.componentRef.setInput('statusClass', 'bg-slate-100 text-slate-600');
    fixture.componentRef.setInput('avatarClass', 'bg-blue-100 text-blue-700');
    fixture.componentRef.setInput('canCreateHistory', true);
    fixture.detectChanges();
  });

  it('conserva el panel lateral y emite la acción de iniciar atención', () => {
    const started = jasmine.createSpy('started');
    component.consultationStarted.subscribe(started);

    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    buttons.find(button => button.textContent?.includes('Iniciar atención'))?.click();

    expect(fixture.nativeElement.querySelector('.sm\\:w-\\[400px\\]')).not.toBeNull();
    expect(started).toHaveBeenCalledWith(jasmine.objectContaining({ id: 10 }));
  });
});
