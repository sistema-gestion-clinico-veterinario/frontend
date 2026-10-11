import { Component, ElementRef, computed, input, model, output, viewChildren } from '@angular/core';

@Component({
  selector: 'app-codigo-verificacion',
  standalone: true,
  template: `
    <span class="sr-only" [id]="etiquetaId">Código de {{ longitud() }} dígitos</span>
    <div class="grid gap-2.5" [style.grid-template-columns]="'repeat(' + longitud() + ', minmax(0, 1fr))'" role="group"
      [attr.aria-labelledby]="etiquetaId">
      @for (i of casillas(); track i) {
        <input #casilla type="text" inputmode="numeric" [attr.maxlength]="longitud()"
          [attr.autocomplete]="i === 0 ? 'one-time-code' : 'off'"
          [attr.aria-label]="'Dígito ' + (i + 1) + ' de ' + longitud()" [value]="digitos()[i]"
          (input)="alEscribir(i, $event)" (keydown)="alPresionar(i, $event)" (paste)="alPegar(i, $event)"
          (focus)="$any($event.target).select()"
          class="h-14 w-full rounded-xl border border-slate-300 text-center text-xl font-semibold text-slate-800 outline-none focus:border-[var(--brand-primary)]" />
      }
    </div>
  `
})
export class CodigoVerificacionComponent {
  readonly codigo = model('');
  readonly longitud = input(6);
  readonly confirmar = output<void>();

  readonly etiquetaId = `codigo-verificacion-${Math.random().toString(36).slice(2, 8)}`;
  readonly casillas = computed(() => Array.from({ length: this.longitud() }, (_, i) => i));
  readonly digitos = computed(() => this.casillas().map(i => {
    const caracter = this.codigo()[i];
    return caracter && caracter !== ' ' ? caracter : '';
  }));

  private readonly campos = viewChildren<ElementRef<HTMLInputElement>>('casilla');

  enfocarPrimero(): void {
    this.enfocar(0);
  }

  alEscribir(indice: number, evento: Event): void {
    const campo = evento.target as HTMLInputElement;
    const soloDigitos = campo.value.replace(/\D/g, '');
    if (!soloDigitos) {
      this.poner(indice, '');
      campo.value = '';
      return;
    }
    const tecleado = (evento as InputEvent).inputType === 'insertText';
    if (soloDigitos.length > 1 && !tecleado) {
      this.rellenar(indice, soloDigitos);
      return;
    }
    const digito = soloDigitos.slice(-1);
    this.poner(indice, digito);
    campo.value = digito;
    this.enfocar(indice + 1);
  }

  alPresionar(indice: number, evento: KeyboardEvent): void {
    if (evento.key === 'Backspace' && !this.digitos()[indice] && indice > 0) {
      evento.preventDefault();
      this.poner(indice - 1, '');
      this.enfocar(indice - 1);
    } else if (evento.key === 'ArrowLeft') {
      evento.preventDefault();
      this.enfocar(indice - 1);
    } else if (evento.key === 'ArrowRight') {
      evento.preventDefault();
      this.enfocar(indice + 1);
    } else if (evento.key === 'Enter') {
      this.confirmar.emit();
    }
  }

  alPegar(indice: number, evento: ClipboardEvent): void {
    evento.preventDefault();
    this.rellenar(indice, (evento.clipboardData?.getData('text') ?? '').replace(/\D/g, ''));
  }

  private poner(indice: number, digito: string): void {
    const actuales = this.digitos().slice();
    actuales[indice] = digito;
    this.codigo.set(actuales.map(d => d || ' ').join('').trimEnd());
  }

  private rellenar(desde: number, digitos: string): void {
    const nuevos = digitos.slice(0, this.longitud() - desde);
    if (!nuevos) return;
    const actuales = this.digitos().slice();
    [...nuevos].forEach((d, k) => (actuales[desde + k] = d));
    this.codigo.set(actuales.map(d => d || ' ').join('').trimEnd());
    this.enfocar(Math.min(desde + nuevos.length, this.longitud() - 1));
  }

  private enfocar(indice: number): void {
    const campo = this.campos()[indice]?.nativeElement;
    if (campo) {
      campo.focus();
      campo.select();
    }
  }
}
