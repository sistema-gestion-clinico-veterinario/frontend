import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({ name: 'mdHtml', standalone: true })
export class MarkdownPipe implements PipeTransform {
  constructor(private san: DomSanitizer) {}

  transform(raw: string): SafeHtml {
    return this.san.bypassSecurityTrustHtml(raw ? this.parse(raw) : '');
  }

  private parse(text: string): string {
    const lines = text.split('\n');
    const out: string[] = [];
    let inList = false;

    for (const line of lines) {
      if (/^## (.+)/.test(line)) {
        if (inList) { out.push('</ul>'); inList = false; }
        out.push(`<h2>${this.inline(line.slice(3).trim())}</h2>`);
      } else if (/^### (.+)/.test(line)) {
        if (inList) { out.push('</ul>'); inList = false; }
        out.push(`<h3>${this.inline(line.slice(4).trim())}</h3>`);
      } else if (/^(\d+)\. .+/.test(line) || /^[-*] .+/.test(line)) {
        if (!inList) { out.push('<ul>'); inList = true; }
        out.push(`<li>${this.inline(line.replace(/^(\d+)\. |^[-*] /, ''))}</li>`);
      } else if (/^\s{2,}[-*] .+/.test(line)) {
        out.push(`<li class="sub">${this.inline(line.replace(/^\s+[-*] /, ''))}</li>`);
      } else if (line.trim() === '') {
        if (inList) { out.push('</ul>'); inList = false; }
      } else {
        if (inList) { out.push('</ul>'); inList = false; }
        out.push(`<p>${this.inline(line)}</p>`);
      }
    }

    if (inList) out.push('</ul>');
    return out.join('');
  }

  private inline(s: string): string {
    const htmlEscaped = s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
    return htmlEscaped
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/\*([^*]+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>');
  }
}
