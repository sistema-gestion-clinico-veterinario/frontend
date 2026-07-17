import { DomSanitizer } from '@angular/platform-browser';
import { MarkdownPipe } from './markdown.pipe';

describe('MarkdownPipe', () => {
  let pipe: MarkdownPipe;

  beforeEach(() => {
    const sanitizer = { bypassSecurityTrustHtml: (value: string) => value } as unknown as DomSanitizer;
    pipe = new MarkdownPipe(sanitizer);
  });

  it('convierte texto plano en parrafo', () => {
    expect(pipe.transform('Hola mundo')).toBe('<p>Hola mundo</p>');
  });

  it('convierte encabezados h2 y h3', () => {
    expect(pipe.transform('## Diagnostico')).toBe('<h2>Diagnostico</h2>');
    expect(pipe.transform('### Subdiagnostico')).toBe('<h3>Subdiagnostico</h3>');
  });

  it('convierte negrita, cursiva y codigo inline', () => {
    expect(pipe.transform('**Negrita** *y* `codigo`')).toBe('<p><b>Negrita</b> <em>y</em> <code>codigo</code></p>');
  });

  it('convierte listas con guion y listas numeradas', () => {
    // Arrange
    const unorderedMarkdown = '- Item 1\n- Item 2';
    const orderedMarkdown = '1. Primero\n2. Segundo';

    // Act
    const unorderedHtml = pipe.transform(unorderedMarkdown);
    const orderedHtml = pipe.transform(orderedMarkdown);

    // Assert
    expect(unorderedHtml).toBe('<ul><li>Item 1</li><li>Item 2</li></ul>');
    expect(orderedHtml).toBe('<ul><li>Primero</li><li>Segundo</li></ul>');
  });

  it('escapa HTML malicioso antes de aplicar markdown', () => {
    // Arrange
    const maliciousHtml = '<script>alert("xss")</script>';

    // Act
    const result = pipe.transform(maliciousHtml);

    // Assert
    expect(result).toBe('<p>&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</p>');
  });

  it('retorna vacio para entradas vacias o nulas', () => {
    // Arrange
    const emptyValue = '';
    const nullValue = null as any;
    const undefinedValue = undefined as any;

    // Act
    const emptyResult = pipe.transform(emptyValue);
    const nullResult = pipe.transform(nullValue);
    const undefinedResult = pipe.transform(undefinedValue);

    // Assert
    expect(emptyResult).toBe('');
    expect(nullResult).toBe('');
    expect(undefinedResult).toBe('');
  });
});
