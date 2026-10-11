import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CodigoVerificacionComponent } from './codigo-verificacion.component';

@Component({
  standalone: true,
  imports: [CodigoVerificacionComponent],
  template: `<app-codigo-verificacion [(codigo)]="valor" (confirmar)="confirmaciones = confirmaciones + 1" />`
})
class AnfitrionComponent {
  valor = signal('');
  confirmaciones = 0;
}

describe('CodigoVerificacionComponent', () => {
  let fixture: ComponentFixture<AnfitrionComponent>;
  let anfitrion: AnfitrionComponent;

  const casillas = () => [...(fixture.nativeElement as HTMLElement).querySelectorAll('input')] as HTMLInputElement[];
  const escribir = (indice: number, texto: string) => {
    const campo = casillas()[indice];
    campo.value = texto;
    campo.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: texto, bubbles: true }));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AnfitrionComponent] }).compileComponents();
    fixture = TestBed.createComponent(AnfitrionComponent);
    anfitrion = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('muestra una casilla por cada dígito', () => {
    expect(casillas().length).toBe(6);
  });

  it('cada dígito escrito se acumula en el código', () => {
    escribir(0, '4');
    escribir(1, '8');
    escribir(2, '2');

    expect(anfitrion.valor()).toBe('482');
  });

  it('ignora lo que no sea un número', () => {
    escribir(0, 'a');

    expect(anfitrion.valor()).toBe('');
  });

  it('pegar un código completo rellena todas las casillas', () => {
    const evento = new ClipboardEvent('paste', { clipboardData: new DataTransfer(), bubbles: true, cancelable: true });
    evento.clipboardData!.setData('text', '123 456');

    casillas()[0].dispatchEvent(evento);
    fixture.detectChanges();

    expect(anfitrion.valor()).toBe('123456');
    expect(casillas().map(c => c.value).join('')).toBe('123456');
  });

  it('Retroceso en una casilla vacía borra el dígito anterior', () => {
    escribir(0, '1');
    escribir(1, '2');
    casillas()[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }));
    fixture.detectChanges();

    expect(anfitrion.valor()).toBe('1');
  });

  it('Enter pide confirmar', () => {
    casillas()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(anfitrion.confirmaciones).toBe(1);
  });
});
