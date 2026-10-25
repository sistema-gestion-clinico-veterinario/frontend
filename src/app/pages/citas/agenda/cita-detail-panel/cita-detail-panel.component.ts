import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';
import { CitaResponse } from '../../../../models/response/cita-response';


@Component({
  selector: 'app-cita-detail-panel',
  standalone: true,
  imports: [CommonModule, HasPermissionDirective],
  templateUrl: './cita-detail-panel.component.html'
})
export class CitaDetailPanelComponent {
  readonly cita = input.required<CitaResponse>();
  readonly statusLabel = input.required<string>();
  readonly statusClass = input.required<string>();
  readonly avatarClass = input.required<string>();
  readonly canCreateHistory = input(false);
  readonly canReadHistory = input(false);
  readonly canModifyHistory = input(false);
  readonly cancellationAllowed = input(false);

  readonly closed = output<void>();
  readonly consultationStarted = output<CitaResponse>();
  readonly consultationContinued = output<CitaResponse>();
  readonly consultationViewed = output<CitaResponse>();
  readonly appointmentCancelled = output<CitaResponse>();
}
