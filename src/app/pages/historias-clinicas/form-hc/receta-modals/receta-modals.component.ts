import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup } from '@angular/forms';
import { PrescripcionResponse } from '../../../../models/response/prescripcion-response';

@Component({
  selector: 'app-receta-modals',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './receta-modals.component.html',
  styleUrl: './receta-modals.component.scss'
})
export class RecetaModalsComponent {
  @Input() showForm = false;
  @Input() recetaEditando: PrescripcionResponse | null = null;
  @Input() consultaNombre = '';
  @Input() form!: FormGroup;
  @Input() showConfirmEliminar = false;
  @Input() recetaEliminando: PrescripcionResponse | null = null;

  @Output() cerrarForm         = new EventEmitter<void>();
  @Output() guardar            = new EventEmitter<void>();
  @Output() cancelarEliminar   = new EventEmitter<void>();
  @Output() confirmarEliminar  = new EventEmitter<void>();

  blockInvalidIntegerInput(event: KeyboardEvent) {
    if (['e', 'E', '+', '-', '.', ','].includes(event.key)) {
      event.preventDefault();
    }
  }

  blockInvalidIntegerPaste(event: ClipboardEvent) {
    const text = event.clipboardData?.getData('text')?.trim() ?? '';
    if (!/^\d{1,3}$/.test(text)) {
      event.preventDefault();
    }
  }

  blockUnsafeTextInput(event: KeyboardEvent) {
    if (/[{}\[\]<>*|\\^~`=@]/.test(event.key)) {
      event.preventDefault();
    }
  }

  blockUnsafeTextPaste(event: ClipboardEvent) {
    const text = event.clipboardData?.getData('text') ?? '';
    if (/[{}\[\]<>*|\\^~`=@]/.test(text)) {
      event.preventDefault();
    }
  }

  validationMessage(controlName: string, requiredMessage = 'Requerido'): string {
    const control = this.form.get(controlName);
    if (!control?.errors) return '';

    if (control.errors['leadingTrailingSpace'] || control.errors['textContent']) {
      return 'Ingrese texto real, sin espacios al inicio/final ni solo puntos, numeros o simbolos.';
    }
    if (control.errors['required']) return requiredMessage;
    if (control.errors['finiteNumber']) return 'Ingrese un numero valido.';
    if (control.errors['integerNumber']) return 'Ingrese un numero entero.';
    if (control.errors['min']) return `Valor minimo: ${control.errors['min'].min}.`;
    if (control.errors['max']) return `Valor maximo: ${control.errors['max'].max}.`;
    if (control.errors['maxlength']) return `Maximo ${control.errors['maxlength'].requiredLength} caracteres.`;

    return 'Valor invalido.';
  }
}
