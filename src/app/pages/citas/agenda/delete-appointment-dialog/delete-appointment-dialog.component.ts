import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { CitaResponse } from '../../../../models/response/cita-response';

@Component({
  selector: 'app-delete-appointment-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './delete-appointment-dialog.component.html'
})
export class DeleteAppointmentDialogComponent {
  readonly cita = input.required<CitaResponse>();
  readonly processing = input(false);
  readonly closed = output<void>();
  readonly confirmed = output<void>();
}
