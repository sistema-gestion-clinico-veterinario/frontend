import { Component, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PendientePrivacidad, PendientesPrivacidadService } from '../../../../core/services/pendientes-privacidad.service';

@Component({
  selector: 'app-pendientes-privacidad-card',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './pendientes-privacidad-card.component.html'
})
export class PendientesPrivacidadCardComponent {
  private readonly servicio = inject(PendientesPrivacidadService);

  collapsed = input(false);
  navigate = output<void>();

  readonly pendientes = this.servicio.pendientes;

  descartar(id: PendientePrivacidad['id']): void {
    this.servicio.descartar(id);
  }
}
