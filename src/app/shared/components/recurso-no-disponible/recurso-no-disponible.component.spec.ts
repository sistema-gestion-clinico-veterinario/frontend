import { TestBed } from '@angular/core/testing';
import { MotivoRecursoNoDisponible, RecursoNoDisponibleComponent, motivoDeError } from './recurso-no-disponible.component';

describe('motivoDeError', () => {
  it('traduce el estado HTTP al motivo que se muestra', () => {
    expect(motivoDeError({ status: 404 })).toBe('NO_ENCONTRADO');
    expect(motivoDeError({ status: 403 })).toBe('SIN_PERMISO');
    expect(motivoDeError({ status: 500 })).toBe('FALLO');
    expect(motivoDeError({ status: 0 })).toBe('FALLO');
    expect(motivoDeError(null)).toBe('FALLO');
  });
});

describe('RecursoNoDisponibleComponent', () => {
  function crear(motivo: MotivoRecursoNoDisponible, nombre = 'producto', femenino = false) {
    TestBed.resetTestingModule();
    const fixture = TestBed.configureTestingModule({ imports: [RecursoNoDisponibleComponent] })
      .createComponent(RecursoNoDisponibleComponent);
    fixture.componentRef.setInput('motivo', motivo);
    fixture.componentRef.setInput('nombre', nombre);
    fixture.componentRef.setInput('femenino', femenino);
    fixture.detectChanges();
    return fixture;
  }
  const texto = (f: ReturnType<typeof crear>) => (f.nativeElement as HTMLElement).textContent ?? '';

  it('concuerda el género en los mensajes', () => {
    expect(texto(crear('NO_ENCONTRADO', 'producto'))).toContain('No encontramos este producto');
    expect(texto(crear('NO_ENCONTRADO', 'historia clínica', true))).toContain('No encontramos esta historia clínica');
    expect(texto(crear('NO_ENCONTRADO', 'historia clínica', true))).toContain('búscala');
    expect(texto(crear('NO_ENCONTRADO', 'producto'))).toContain('búscalo');
  });

  it('sin permiso indica pedir acceso al administrador y no ofrece reintentar', () => {
    const f = crear('SIN_PERMISO', 'consulta', true);
    expect(texto(f)).toContain('No tienes acceso a esta consulta');
    expect(texto(f)).toContain('administrador de tu clínica');
    expect(texto(f)).not.toContain('Reintentar');
  });

  it('ante un fallo ofrece reintentar y emite los eventos', () => {
    const f = crear('FALLO', 'producto');
    let volvio = 0, reintento = 0;
    f.componentInstance.volver.subscribe(() => volvio++);
    f.componentInstance.reintentar.subscribe(() => reintento++);
    expect(texto(f)).toContain('No se pudo cargar el producto');

    const botones = (f.nativeElement as HTMLElement).querySelectorAll('button');
    expect(botones.length).toBe(2);
    botones[0].click();
    botones[1].click();
    expect([volvio, reintento]).toEqual([1, 1]);
  });
});
