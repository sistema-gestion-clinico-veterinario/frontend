import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { InputFilterDirective } from '../../../../core/directives/input-filter.directive';
import { AppointmentFormContext } from './appointment-form-context';

@Component({
  selector: 'app-appointment-form-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, InputFilterDirective],
  templateUrl: './appointment-form-panel.component.html'
})
export class AppointmentFormPanelComponent {
  readonly context = input.required<AppointmentFormContext>();
}
