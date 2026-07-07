import { MarkdownPipe } from './markdown.pipe';

describe('MarkdownPipe', () => {
  let pipe: MarkdownPipe;

  beforeEach(() => {
    const mockSanitizer = { bypassSecurityTrustHtml: (v: string) => v } as any;
    pipe = new MarkdownPipe(mockSanitizer);
  });

  it('converts ## heading to <h2> element', () => {
    const result = pipe.transform('## Diagnóstico') as string;
    expect(result).toContain('<h2>Diagnóstico</h2>');
  });

  it('converts **bold** markers to <b> element', () => {
    const result = pipe.transform('**negrita**') as string;
    expect(result).toContain('<b>negrita</b>');
  });

  it('converts *italic* markers to <em> element', () => {
    const result = pipe.transform('*cursiva*') as string;
    expect(result).toContain('<em>cursiva</em>');
  });

  it('wraps - list item inside <ul> with <li>', () => {
    const result = pipe.transform('- elemento') as string;
    expect(result).toContain('<ul>');
    expect(result).toContain('<li>elemento</li>');
  });

  it('escapes HTML special characters to prevent injection', () => {
    const result = pipe.transform('<script>alert(1)</script>') as string;
    expect(result).toContain('&lt;script&gt;');
    expect(result).not.toContain('<script>');
  });
});
