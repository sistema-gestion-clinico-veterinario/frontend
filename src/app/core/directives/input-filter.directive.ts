import { Directive, ElementRef, HostListener, Input, Optional, Self, inject } from '@angular/core';
import { NgControl } from '@angular/forms';

type InputFilterMode = 'letters' | 'digits' | 'alphanumeric';

@Directive({
  selector: '[appInputFilter]',
  standalone: true
})
export class InputFilterDirective {
  @Input('appInputFilter') mode: InputFilterMode = 'letters';
  @Input() appInputFilterMaxLength?: number;

  private readonly element = inject(ElementRef<HTMLInputElement>);

  constructor(@Optional() @Self() private readonly ngControl: NgControl | null) {}

  @HostListener('beforeinput', ['$event'])
  onBeforeInput(event: InputEvent) {
    if (!event.data) return;
    if (this.sanitize(event.data) !== event.data) {
      event.preventDefault();
    }
  }
  @HostListener('paste', ['$event'])
  onPaste(event: ClipboardEvent) {
    event.preventDefault();
    const input = this.element.nativeElement;
    const text = this.sanitize(event.clipboardData?.getData('text') ?? '');
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const nextValue = this.sanitize(input.value.slice(0, start) + text + input.value.slice(end));

    input.value = nextValue;
    this.ngControl?.control?.setValue(nextValue);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  @HostListener('input')
  onInput() {
    const input = this.element.nativeElement;
    const cleanValue = this.sanitize(input.value);
    if (input.value === cleanValue) return;

    input.value = cleanValue;
    this.ngControl?.control?.setValue(cleanValue, { emitEvent: false });
  }

  private sanitize(value: string): string {
    let sanitized = '';
    if (this.mode === 'digits') {
      sanitized = value.replace(/\D/g, '');
    } else if (this.mode === 'alphanumeric') {
      for (let i = 0; i < value.length; i++) {
        const ch = value[i];
        if (i === 0) {
          if (/[A-Za-z0-9]/.test(ch)) {
            sanitized += ch.toUpperCase();
          }
        } else {
          if (/\d/.test(ch)) {
            sanitized += ch;
          }
        }
      }
    } else {
      sanitized = value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]/g, '');
    }
    return this.appInputFilterMaxLength ? sanitized.slice(0, this.appInputFilterMaxLength) : sanitized;
  }
}