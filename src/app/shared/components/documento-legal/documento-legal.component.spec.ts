import { TestBed } from '@angular/core/testing';
import { DocumentoLegalComponent, estructurarDocumento } from './documento-legal.component';

const AVISO = [
  'AVISO DE PRIVACIDAD - PROPIETARIOS Y PERSONAS AUTORIZADAS - Versión 1',
  '',
  '1. Quién trata sus datos',
  'El titular del banco de datos personales es Clínica Patitas.',
  'Encargado del tratamiento: VetSoft.',
  '',
  '2. Qué datos se registran',
  'Datos obligatorios, sin los cuales no podemos atender a su mascota:',
  '- Nombres y apellidos',
  '- Correo electrónico',
  'Datos facultativos:',
  '- Referencias',
  '',
  '3. Para qué se usan',
  'Recordatorios opcionales: solo si usted los autoriza.'
].join('\n');

describe('estructurarDocumento', () => {
  it('separa el encabezado del documento y las secciones numeradas', () => {
    const secciones = estructurarDocumento(AVISO);

    expect(secciones[0].numero).toBeNull();
    expect(secciones[0].bloques[0].lineas[0]).toContain('AVISO DE PRIVACIDAD');
    expect(secciones.filter(s => s.numero !== null).map(s => `${s.numero}:${s.titulo}`)).toEqual([
      '1:Quién trata sus datos',
      '2:Qué datos se registran',
      '3:Para qué se usan'
    ]);
  });

  it('distingue párrafos y listas con viñetas sin perder ninguna línea', () => {
    const seccion = estructurarDocumento(AVISO).find(s => s.numero === '2')!;

    expect(seccion.bloques.map(b => b.tipo)).toEqual(['texto', 'lista', 'texto', 'lista']);
    expect(seccion.bloques[1].lineas).toEqual(['Nombres y apellidos', 'Correo electrónico']);
    const total = estructurarDocumento(AVISO).flatMap(s => s.bloques).flatMap(b => b.lineas).length;
    expect(total).toBe(AVISO.split('\n').filter(l => l.trim()).length - 3);
  });

  it('no toma como título una línea larga o con punto final', () => {
    const secciones = estructurarDocumento('1. Objeto\n2. Esta frase termina en punto y es parte del texto.');
    expect(secciones.filter(s => s.numero !== null).length).toBe(1);
  });
});

describe('DocumentoLegalComponent', () => {
  function render(contenido: string, compacto = false) {
    const fixture = TestBed.configureTestingModule({ imports: [DocumentoLegalComponent] })
      .createComponent(DocumentoLegalComponent);
    fixture.componentRef.setInput('contenido', contenido);
    fixture.componentRef.setInput('compacto', compacto);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('muestra una tarjeta por sección y un índice navegable', () => {
    const el = render(AVISO);

    expect(el.querySelectorAll('section').length).toBe(3);
    expect(el.querySelectorAll('nav li').length).toBe(3);
    expect(el.textContent).toContain('Qué datos se registran');
    expect(el.querySelectorAll('ul li').length).toBe(3);
  });

  it('oculta el índice en modo compacto', () => {
    expect(render(AVISO, true).querySelector('nav')).toBeNull();
  });

  it('muestra el texto tal cual cuando no tiene secciones numeradas', () => {
    const el = render('Texto libre sin numeración\nsegunda línea');
    expect(el.querySelector('section')).toBeNull();
    expect(el.textContent).toContain('segunda línea');
  });
});
