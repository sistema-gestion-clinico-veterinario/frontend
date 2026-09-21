import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup } from '@angular/forms';
import { TratamientoResponse } from '../../../../models/response/tratamiento-response';

@Component({
  selector: 'app-tratamiento-modals',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './tratamiento-modals.component.html'
})
export class TratamientoModalsComponent {
  @Input() showForm = false;
  @Input() tratamientoEditando: TratamientoResponse | null = null;
  @Input() consultaNombre = '';
  @Input() form!: FormGroup;
  @Input() showConfirmEliminar = false;
  @Input() tratamientoEliminando: TratamientoResponse | null = null;

  @Output() cerrarForm         = new EventEmitter<void>();
  @Output() guardar            = new EventEmitter<void>();
  @Output() cancelarEliminar   = new EventEmitter<void>();
  @Output() confirmarEliminar  = new EventEmitter<void>();

  readonly estados = [
    { label: 'Pendiente', value: 'PENDIENTE' },
    { label: 'Activo', value: 'ACTIVO' },
    { label: 'En curso', value: 'EN_CURSO' },
    { label: 'Completado', value: 'COMPLETADO' },
    { label: 'Suspendido', value: 'SUSPENDIDO' },
    { label: 'Otro', value: 'OTRO' }
  ];

  blockUnsafeTextInput(event: KeyboardEvent) {
    if (event.key.length > 1) return;
    if (!this.isAllowedText(event.key)) {
      event.preventDefault();
    }
  }

  blockUnsafeTextPaste(event: ClipboardEvent) {
    const text = event.clipboardData?.getData('text') ?? '';
    if (this.cleanText(text) !== text) {
      event.preventDefault();
    }
  }

  sanitizeTextField(controlName: string) {
    const control = this.form.get(controlName);
    const value = control?.value;
    if (typeof value !== 'string') return;
    const cleaned = this.cleanText(value);
    if (cleaned !== value) {
      control?.setValue(cleaned, { emitEvent: false });
    }
  }

  private cleanText(value: string): string {
    return Array.from(value).filter((char) => this.isAllowedText(char)).join('');
  }

  private isAllowedText(char: string): boolean {
    return /^[\p{L}\p{N}\s.,;:()\/\-+°%]$/u.test(char);
  }

  validationMessage(controlName: string, requiredMessage = 'Requerido'): string {
    const control = this.form.get(controlName);
    if (!control?.errors) return '';

    if (control.errors['leadingTrailingSpace'] || control.errors['textContent']) {
      return 'Ingrese texto real, sin espacios al inicio/final ni solo puntos, numeros o simbolos.';
    }
    if (control.errors['required']) return requiredMessage;
    if (control.errors['pattern']) return 'Use solo letras, numeros y puntuacion basica.';
    if (control.errors['maxlength']) return `Maximo ${control.errors['maxlength'].requiredLength} caracteres.`;

    return 'Valor invalido.';
  }
}
