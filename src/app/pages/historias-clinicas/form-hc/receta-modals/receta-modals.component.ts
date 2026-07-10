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
    if (event.key.length > 1) return;
    if (!this.isAllowedText(event.key)) {
      event.preventDefault();
    }
  }

  blockMedicineNameInput(event: KeyboardEvent) {
    if (event.key.length > 1) return;
    if (!this.isAllowedText(event.key, false)) {
      event.preventDefault();
    }
  }

  blockUnsafeTextPaste(event: ClipboardEvent) {
    const text = event.clipboardData?.getData('text') ?? '';
    if (this.cleanText(text) !== text) {
      event.preventDefault();
    }
  }

  blockMedicineNamePaste(event: ClipboardEvent) {
    const text = event.clipboardData?.getData('text') ?? '';
    if (this.cleanText(text, false) !== text) {
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

  sanitizeMedicineNameField(controlName: string) {
    const control = this.form.get(controlName);
    const value = control?.value;
    if (typeof value !== 'string') return;
    const cleaned = this.cleanText(value, false);
    if (cleaned !== value) {
      control?.setValue(cleaned, { emitEvent: false });
    }
  }

  private cleanText(value: string, allowNumbers = true): string {
    return Array.from(value).filter((char) => this.isAllowedText(char, allowNumbers)).join('');
  }

  private isAllowedText(char: string, allowNumbers = true): boolean {
    if (!allowNumbers) return /^[\p{L}\s.,;:()\/\-+%]$/u.test(char);
    return /^[\p{L}\p{N}\s.,;:()\/\-+°%]$/u.test(char);
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
    if (control.errors['pattern']) return 'Use solo letras y puntuacion basica; no ingrese numeros ni simbolos especiales.';
    if (control.errors['min']) return `Valor minimo: ${control.errors['min'].min}.`;
    if (control.errors['max']) return `Valor maximo: ${control.errors['max'].max}.`;
    if (control.errors['maxlength']) return `Maximo ${control.errors['maxlength'].requiredLength} caracteres.`;

    return 'Valor invalido.';
  }
}
