import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DeleteAppointmentDialogComponent } from './delete-appointment-dialog.component';

describe('DeleteAppointmentDialogComponent', () => {
  let fixture: ComponentFixture<DeleteAppointmentDialogComponent>;
  let component: DeleteAppointmentDialogComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DeleteAppointmentDialogComponent] }).compileComponents();
    fixture = TestBed.createComponent(DeleteAppointmentDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('cita', {
      mascotaNombre: 'Luna',
      fechaHoraInicio: '2026-10-12T10:00:00'
    } as any);
    fixture.detectChanges();
  });

  it('mantiene la confirmación visual y emite la eliminación', () => {
    const confirmed = jasmine.createSpy('confirmed');
    component.confirmed.subscribe(confirmed);

    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    buttons.find(button => button.textContent?.trim() === 'Eliminar')?.click();

    expect(fixture.nativeElement.querySelector('.max-w-md')).not.toBeNull();
    expect(confirmed).toHaveBeenCalled();
  });
});
