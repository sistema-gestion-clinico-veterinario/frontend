import { MarkdownPipe } from './markdown.pipe';
import { DomSanitizer } from '@angular/platform-browser';

describe('MarkdownPipe', () => {
  let pipe: MarkdownPipe;

  beforeEach(() => {
    const sanitizer = { bypassSecurityTrustHtml: (v: string) => v } as unknown as DomSanitizer;
    pipe = new MarkdownPipe(sanitizer);
  });

  // ────────────── Happy path (camino feliz) ──────────────

  it('convierte texto plano en párrafo', () => {
    const resultado = pipe.transform('Hola mundo');
    expect(resultado).toBe('<p>Hola mundo</p>');
  });

  it('convierte ## Título en h2', () => {
    const resultado = pipe.transform('## Diagnóstico');
    expect(resultado).toBe('<h2>Diagnóstico</h2>');
  });

  it('convierte ### Título en h3', () => {
    const resultado = pipe.transform('### Subdiagnóstico');
    expect(resultado).toBe('<h3>Subdiagnóstico</h3>');
  });

  it('convierte **negritas** en <b>', () => {
    const resultado = pipe.transform('Esto es **importante**');
    expect(resultado).toBe('<p>Esto es <b>importante</b></p>');
  });

  it('convierte *cursiva* en <em>', () => {
    const resultado = pipe.transform('Texto *inclinado*');
    expect(resultado).toBe('<p>Texto <em>inclinado</em></p>');
  });

  it('convierte `código` en <code>', () => {
    const resultado = pipe.transform('Usa `rm -rf` con cuidado');
    expect(resultado).toBe('<p>Usa <code>rm -rf</code> con cuidado</p>');
  });

  it('convierte lista con - item', () => {
    const resultado = pipe.transform('- Item 1\n- Item 2');
    expect(resultado).toBe('<ul><li>Item 1</li><li>Item 2</li></ul>');
  });

  it('convierte lista numerada', () => {
    const resultado = pipe.transform('1. Primero\n2. Segundo');
    expect(resultado).toBe('<ul><li>Primero</li><li>Segundo</li></ul>');
  });

  it('combina títulos, listas y párrafos', () => {
    const md = '## Resumen\n\nPrimer párrafo\n\n- Punto 1\n- Punto 2';
    const resultado = pipe.transform(md);
    expect(resultado).toContain('<h2>Resumen</h2>');
    expect(resultado).toContain('<p>Primer párrafo</p>');
    expect(resultado).toContain('<li>Punto 1</li>');
  });

  it('retorna vacío para entrada vacía', () => {
    expect(pipe.transform('')).toBe('');
    expect(pipe.transform(null as any)).toBe('');
    expect(pipe.transform(undefined as any)).toBe('');
  });

  // ────────────── Escape de HTML ──────────────

  it('escapa HTML malicioso', () => {
    const resultado = pipe.transform('<script>alert("xss")</script>');
    expect(resultado).toBe('<p>&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</p>');
  });

  it('escapa etiquetas HTML en medio del texto', () => {
    const resultado = pipe.transform('Hola <b>no</b> debe renderizar');
    expect(resultado).toBe('<p>Hola &lt;b&gt;no&lt;/b&gt; debe renderizar</p>');
  });

  it('escapa & en texto plano', () => {
    const resultado = pipe.transform('AT&T');
    expect(resultado).toBe('<p>AT&amp;T</p>');
  });

  it('escapa & dentro de **negritas**', () => {
    const resultado = pipe.transform('**A & B**');
    // & se escapa ANTES de aplicar markdown, luego ** se convierte en <b>
    expect(resultado).toBe('<p><b>A &amp; B</b></p>');
  });

  it('escapa & dentro de `código`', () => {
    const resultado = pipe.transform('`A & B`');
    // & se escapa primero, luego los backticks se convierten en <code>
    expect(resultado).toBe('<p><code>A &amp; B</code></p>');
  });

  // ────────────── Inline dentro de encabezados ──────────────

  it('aplica inline dentro de ## h2', () => {
    const resultado = pipe.transform('## Título **importante**');
    expect(resultado).toBe('<h2>Título <b>importante</b></h2>');
  });

  it('aplica inline dentro de ### h3', () => {
    const resultado = pipe.transform('### Nota *importante*');
    expect(resultado).toBe('<h3>Nota <em>importante</em></h3>');
  });

  // ────────────── Líneas vacías entre párrafos ──────────────

  it('respeta párrafos separados por línea vacía', () => {
    const resultado = pipe.transform('Párrafo uno\n\nPárrafo dos');
    expect(resultado).toBe('<p>Párrafo uno</p><p>Párrafo dos</p>');
  });

  it('línea vacía entre items cierra y abre nueva lista', () => {
    const resultado = pipe.transform('- A\n\n- B');
    expect(resultado).toBe('<ul><li>A</li></ul><ul><li>B</li></ul>');
  });

  // ────────────── Sub-listas (indentadas) ──────────────

  it('convierte item con indentación en sub-lista', () => {
    const resultado = pipe.transform('- Principal\n  - Secundario');
    // La sub-lista se mantiene dentro del mismo <ul> como <li class="sub">
    expect(resultado).toBe('<ul><li>Principal</li><li class="sub">Secundario</li></ul>');
  });

  // ────────────── Texto sin salto de línea ──────────────

  it('texto sin \\n se envuelve en un solo <p>', () => {
    const resultado = pipe.transform('Línea única');
    expect(resultado).toBe('<p>Línea única</p>');
  });

  // ────────────── Combinación de inline ──────────────

  it('combina **negrita**, *cursiva* y `código` en un párrafo', () => {
    const resultado = pipe.transform('**Negrita** *y* `código`');
    expect(resultado).toBe('<p><b>Negrita</b> <em>y</em> <code>código</code></p>');
  });

  // ────────────── Encabezados consecutivos ──────────────

  it('convierte encabezados consecutivos sin contenido intermedio', () => {
    const resultado = pipe.transform('## Primero\n### Segundo');
    expect(resultado).toBe('<h2>Primero</h2><h3>Segundo</h3>');
  });

  // ────────────── BUG: backticks no protegen ** ni * ──────────────
  // La implementación actual aplica **bold** y *italic* ANTES que `código`
  // en inline(), por lo que el contenido dentro de backticks se procesa
  // como markdown en lugar de mostrarse literal.
  // Este test debe fallar con el código actual. Cuando se corrija el orden
  // (procesar backticks primero), este test debe pasar.

  xit('BUG: `código` con **bold** dentro debe mostrar ** literales', () => {
    const resultado = pipe.transform('Esto es `**no negrita**` literal');
    // Comportamiento esperado (correcto): el ** dentro de backticks NO se procesa
    expect(resultado).toBe('<p>Esto es <code>**no negrita**</code> literal</p>');
    // Comportamiento actual (incorrecto): devuelve
    // '<p>Esto es <code><b>no negrita</b></code> literal</p>'
  });

  xit('BUG: `código` con *cursiva* dentro debe mostrar * literales', () => {
    const resultado = pipe.transform('`*no cursiva*`');
    expect(resultado).toBe('<p><code>*no cursiva*</code></p>');
    // Actual: '<p><code><em>no cursiva</em></code></p>'
  });
});
