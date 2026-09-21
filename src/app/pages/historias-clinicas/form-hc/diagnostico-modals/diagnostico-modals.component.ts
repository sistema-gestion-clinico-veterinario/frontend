import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup } from '@angular/forms';
import { DiagnosticoResponse } from '../../../../models/response/diagnostico-response';

@Component({
  selector: 'app-diagnostico-modals',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './diagnostico-modals.component.html'
})
export class DiagnosticoModalsComponent {
  @Input() showForm = false;
  @Input() diagnosticoEditando: DiagnosticoResponse | null = null;
  @Input() consultaNombre = '';
  @Input() form!: FormGroup;
  @Input() showConfirmEliminar = false;
  @Input() diagnosticoEliminando: DiagnosticoResponse | null = null;

  @Output() cerrarForm         = new EventEmitter<void>();
  @Output() guardar            = new EventEmitter<void>();
  @Output() cancelarEliminar   = new EventEmitter<void>();
  @Output() confirmarEliminar  = new EventEmitter<void>();

  readonly tipos = [
    { label: 'Presuntivo', value: 'PRESUNTIVO' },
    { label: 'Definitivo', value: 'DEFINITIVO' },
    { label: 'Diferencial', value: 'DIFERENCIAL' },
    { label: 'Otro', value: 'OTRO' }
  ];

  readonly estados = [
    { label: 'Activo', value: 'ACTIVO' },
    { label: 'Resuelto', value: 'RESUELTO' },
    { label: 'Crónico', value: 'CRONICO' },
    { label: 'En seguimiento', value: 'EN_SEGUIMIENTO' },
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
