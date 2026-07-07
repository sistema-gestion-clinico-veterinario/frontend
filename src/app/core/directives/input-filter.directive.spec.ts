import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { InputFilterDirective } from './input-filter.directive';

@Component({
  standalone: true,
  imports: [InputFilterDirective],
  template: `<input [appInputFilter]="mode" [appInputFilterMaxLength]="maxLen" />`,
})
class FilterHost {
  mode: 'letters' | 'digits' | 'alphanumeric' = 'digits';
  maxLen: number | undefined;
}

@Component({
  standalone: true,
  imports: [InputFilterDirective, ReactiveFormsModule],
  template: `<input [appInputFilter]="mode" [formControl]="ctrl" />`,
})
class FilterHostWithControl {
  mode: 'letters' | 'digits' | 'alphanumeric' = 'digits';
  ctrl = new FormControl('');
}

function pasteText(input: HTMLInputElement, text: string) {
  const dt = new DataTransfer();
  dt.setData('text/plain', text);
  input.dispatchEvent(
    new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt })
  );
}

describe('InputFilterDirective – event integration', () => {
  describe('without FormControl', () => {
    let fixture: ComponentFixture<FilterHost>;
    let host: FilterHost;
    let input: HTMLInputElement;

    beforeEach(async () => {
      await TestBed.configureTestingModule({ imports: [FilterHost] }).compileComponents();
      fixture = TestBed.createComponent(FilterHost);
      host = fixture.componentInstance;
      fixture.detectChanges();
      input = fixture.debugElement.query(By.css('input')).nativeElement;
    });

    it('paste en modo digits elimina letras y símbolos del texto pegado', () => {
      host.mode = 'digits';
      fixture.detectChanges();
      pasteText(input, 'abc123def');
      expect(input.value).toBe('123');
    });

    it('onInput corrige un valor ya escrito que contiene caracteres inválidos', () => {
      host.mode = 'letters';
      fixture.detectChanges();
      input.value = 'hello123!';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      expect(input.value).toBe('hello');
    });

    it('onInput en modo letters conserva caracteres acentuados', () => {
      host.mode = 'letters';
      fixture.detectChanges();
      input.value = 'José123';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      expect(input.value).toBe('José');
    });

    it('onInput en modo alphanumeric capitaliza el primer carácter', () => {
      host.mode = 'alphanumeric';
      fixture.detectChanges();
      input.value = 'a123';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      expect(input.value).toBe('A123');
    });

    it('keydown con espacio en posición 0 es bloqueado (defaultPrevented)', () => {
      input.value = '';
      input.setSelectionRange(0, 0);
      const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
      input.dispatchEvent(event);
      expect(event.defaultPrevented).toBeTrue();
    });

    it('keydown con espacio doble consecutivo es bloqueado', () => {
      host.mode = 'letters';
      fixture.detectChanges();
      input.value = 'hola ';
      input.setSelectionRange(5, 5);
      const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
      input.dispatchEvent(event);
      expect(event.defaultPrevented).toBeTrue();
    });

    it('paste respeta maxLength y trunca el resultado sanitizado', () => {
      host.mode = 'digits';
      host.maxLen = 4;
      fixture.detectChanges();
      pasteText(input, '12345678');
      expect(input.value).toBe('1234');
    });
  });

  describe('con FormControl (integración ngControl)', () => {
    let fixture: ComponentFixture<FilterHostWithControl>;
    let host: FilterHostWithControl;
    let input: HTMLInputElement;

    beforeEach(async () => {
      await TestBed.configureTestingModule({ imports: [FilterHostWithControl] }).compileComponents();
      fixture = TestBed.createComponent(FilterHostWithControl);
      host = fixture.componentInstance;
      fixture.detectChanges();
      input = fixture.debugElement.query(By.css('input')).nativeElement;
    });

    it('paste actualiza el FormControl vinculado con el valor sanitizado', () => {
      host.mode = 'digits';
      fixture.detectChanges();
      pasteText(input, 'abc456xyz');
      expect(host.ctrl.value).toBe('456');
    });
  });
});
