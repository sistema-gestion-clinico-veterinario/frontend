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
    expect(pipe.transform('- Item 1\n- Item 2')).toBe('<ul><li>Item 1</li><li>Item 2</li></ul>');
    expect(pipe.transform('1. Primero\n2. Segundo')).toBe('<ul><li>Primero</li><li>Segundo</li></ul>');
  });

  it('escapa HTML malicioso antes de aplicar markdown', () => {
    expect(pipe.transform('<script>alert("xss")</script>')).toBe('<p>&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</p>');
  });

  it('neutraliza payloads XSS comunes sin crear nodos o atributos ejecutables', () => {
    const payloads = [
      '<img src=x onerror=alert(1)>',
      '<svg onload=alert(1)>',
      '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
      '<a href="javascript:alert(1)">abrir</a>',
      '**<ScRiPt>alert(1)</ScRiPt>**',
      '- <img src=x onerror=alert(1)>',
    ];

    for (const payload of payloads) {
      const host = document.createElement('div');
      host.innerHTML = pipe.transform(payload) as unknown as string;

      expect(host.querySelector('script, img, svg, iframe, object, embed')).toBeNull();
      expect(host.querySelector('[onerror], [onload], [srcdoc]')).toBeNull();
      expect(host.querySelector('[href^="javascript:"]')).toBeNull();
      expect(host.textContent).toContain(payload.replace(/\*\*/g, '').replace(/^-\s*/, ''));
    }
  });

  it('retorna vacio para entradas vacias o nulas', () => {
    expect(pipe.transform('')).toBe('');
    expect(pipe.transform(null as any)).toBe('');
    expect(pipe.transform(undefined as any)).toBe('');
  });
});
