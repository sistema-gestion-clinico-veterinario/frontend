import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PaymentDialogComponent } from './payment-dialog.component';

describe('PaymentDialogComponent', () => {
  let fixture: ComponentFixture<PaymentDialogComponent>;
  let component: PaymentDialogComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PaymentDialogComponent] }).compileComponents();
    fixture = TestBed.createComponent(PaymentDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('cita', {
      mascotaNombre: 'Luna',
      apoderadoNombre: 'Ana Perez',
      veterinarioNombre: 'Dr. Ruiz',
      fechaHoraInicio: '2026-10-12T10:00:00',
      servicioNombre: 'Consulta'
    } as any);
    fixture.componentRef.setInput('total', 50);
    fixture.componentRef.setInput('method', 'EFECTIVO');
    fixture.componentRef.setInput('cashBills', [10, 20, 50, 100, 200]);
    fixture.detectChanges();
  });

  it('conserva el modal y comunica la selección de Yape', () => {
    const changed = jasmine.createSpy('changed');
    component.methodChanged.subscribe(changed);

    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    buttons.find(button => button.textContent?.includes('Yape'))?.click();

    expect(fixture.nativeElement.querySelector('.max-w-md')).not.toBeNull();
    expect(changed).toHaveBeenCalledWith('YAPE');
  });
});
