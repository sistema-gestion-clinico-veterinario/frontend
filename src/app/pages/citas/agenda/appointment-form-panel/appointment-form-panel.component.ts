import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { InputFilterDirective } from '../../../../core/directives/input-filter.directive';
import { AppointmentFormContext } from './appointment-form-context';

/**
 * Contrato de presentación del formulario de cita.
 *
 * La lógica de negocio permanece en AgendaComponent y este componente solo
 * renderiza el formulario. Esto permite diferir el HTML pesado sin duplicar
 * reglas de validación, permisos ni llamadas a servicios.
 */
@Component({
  selector: 'app-appointment-form-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, InputFilterDirective],
  templateUrl: './appointment-form-panel.component.html'
})
export class AppointmentFormPanelComponent {
  readonly context = input.required<AppointmentFormContext>();
}
