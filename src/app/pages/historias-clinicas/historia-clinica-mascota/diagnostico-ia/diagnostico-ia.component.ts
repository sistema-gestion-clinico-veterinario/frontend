import { Component, Input, inject, signal, OnChanges, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subscription, firstValueFrom } from 'rxjs';
import { DiagnosticoIaService } from '../../../../core/services/diagnostico-ia.service';
import { MediaService } from '../../../../core/services/media.service';
import { ESCENARIO_LABEL } from '../../../../models/response/diagnostico-ia-response';
import {
  HistoriaClinicaDetalle,
  ConsultaResumen,
  ArchivoClinico,
} from '../../../../models/response/historia-clinica-response';
import { MarkdownPipe } from './markdown.pipe';

@Component({
  selector: 'app-diagnostico-ia',
  standalone: true,
  imports: [CommonModule, MarkdownPipe],
  templateUrl: './diagnostico-ia.component.html',
  encapsulation: ViewEncapsulation.None,
  styles: [`
    .ia-report h2 {
      font-size: 0.68rem;
      font-weight: 800;
      color: #0066AA;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      margin: 1rem 0 0.35rem;
      padding-bottom: 0.25rem;
      border-bottom: 1.5px solid #e2e8f0;
    }
    .ia-report h2:first-child { margin-top: 0; }
    .ia-report h3 {
      font-size: 0.7rem;
      font-weight: 700;
      color: #1e293b;
      margin: 0.65rem 0 0.2rem;
    }
    .ia-report p {
      font-size: 0.72rem;
      color: #475569;
      line-height: 1.65;
      margin: 0.2rem 0;
    }
    .ia-report ul {
      margin: 0.3rem 0 0.3rem 0;
      padding-left: 1.1rem;
      list-style-type: disc;
    }
    .ia-report li {
      font-size: 0.72rem;
      color: #475569;
      line-height: 1.6;
      margin: 0.15rem 0;
    }
    .ia-report li.sub {
      margin-left: 1rem;
      list-style-type: circle;
    }
    .ia-report b {
      font-weight: 700;
      color: #0f172a;
    }
    .ia-report em { font-style: italic; }
    .ia-report code {
      font-family: monospace;
      font-size: 0.65rem;
      background: #f1f5f9;
      padding: 1px 5px;
      border-radius: 3px;
      color: #0f172a;
    }
  `],
})
export class DiagnosticoIaComponent implements OnChanges {
  @Input() hc!: HistoriaClinicaDetalle;

  private readonly iaService    = inject(DiagnosticoIaService);
  private readonly http         = inject(HttpClient);
  private readonly mediaService = inject(MediaService);
  private streamSub: Subscription | null = null;

  abierto    = signal(false);
  analizando = signal(false);
  streaming  = signal(false);
  error      = signal<string | null>(null);
  texto      = signal('');
  escenario  = signal('');
  copiado    = signal(false);

  get todasConsultas(): ConsultaResumen[] {
    return this.hc?.consultas ?? [];
  }

  get archivosLab(): ArchivoClinico[] {
    return this.todasConsultas.flatMap(c => c.archivos.filter(a => a.tipo === 'LABORATORIO'));
  }

  get archivosRadio(): ArchivoClinico[] {
    return this.todasConsultas.flatMap(c => c.archivos.filter(a => a.tipo === 'RADIOGRAFIA'));
  }

  get tieneHemograma(): boolean  { return this.archivosLab.length > 0; }
  get tieneRadiografia(): boolean { return this.archivosRadio.length > 0; }
  get tieneEcografia(): boolean {
    return this.todasConsultas.some(c => c.archivos.some(a => a.tipo === 'ECOGRAFIA'));
  }

  get totalDiagnosticos(): number {
    return this.todasConsultas.reduce((acc, c) => acc + c.diagnosticos.length, 0);
  }

  get escenarioLabel(): string {
    return ESCENARIO_LABEL[this.escenario()] ?? this.escenario();
  }

  ngOnChanges(): void {
    this.texto.set('');
    this.error.set('');
    this.escenario.set('');
    this.copiado.set(false);
  }

  abrir(): void  { this.abierto.set(true); }
  cerrar(): void { this.abierto.set(false); }

  copiarTexto(): void {
    navigator.clipboard.writeText(this.texto()).then(() => {
      this.copiado.set(true);
      setTimeout(() => this.copiado.set(false), 2000);
    });
  }

  descargando = signal(false);

  async descargarComoWord(): Promise<void> {
    if (this.descargando()) return;
    this.descargando.set(true);
    try {
      const { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle } = await import('docx');

      const nombre  = this.hc.mascotaNombre ?? 'Paciente';
      const especie = this.hc.especie       ?? '—';
      const raza    = this.hc.raza          ?? '—';
      const sexo    = this.hc.sexo          ?? '—';
      const fecha   = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });

      const encabezado: InstanceType<typeof Paragraph>[] = [
        new Paragraph({
          text: 'Informe de Diagnóstico IA',
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 120 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Paciente: ', bold: true }),
            new TextRun({ text: nombre }),
            new TextRun({ text: '   •   ', color: 'AAAAAA' }),
            new TextRun({ text: 'Especie: ', bold: true }),
            new TextRun({ text: especie }),
            new TextRun({ text: '   •   ', color: 'AAAAAA' }),
            new TextRun({ text: 'Raza: ', bold: true }),
            new TextRun({ text: raza }),
          ],
          spacing: { after: 60 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Sexo: ', bold: true }),
            new TextRun({ text: sexo }),
            new TextRun({ text: '   •   ', color: 'AAAAAA' }),
            new TextRun({ text: 'Fecha de análisis: ', bold: true }),
            new TextRun({ text: fecha }),
            ...(this.escenario() ? [
              new TextRun({ text: '   •   ', color: 'AAAAAA' }),
              new TextRun({ text: 'Tipo de análisis: ', bold: true }),
              new TextRun({ text: this.escenarioLabel }),
            ] : []),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          border: { bottom: { color: 'CCCCCC', space: 1, style: BorderStyle.SINGLE, size: 4 } },
          spacing: { after: 240 },
        }),
      ];

      const contenido: InstanceType<typeof Paragraph>[] = [];
      for (const rawLine of this.texto().split('\n')) {
        const line = rawLine.replace(/\r$/, '');
        if (line.startsWith('## ')) {
          contenido.push(new Paragraph({
            text: line.slice(3).trim(),
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 80 },
          }));
        } else if (line.startsWith('### ')) {
          contenido.push(new Paragraph({
            text: line.slice(4).trim(),
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 160, after: 60 },
          }));
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
          contenido.push(new Paragraph({
            bullet: { level: 0 },
            children: this.parseLine(line.slice(2), TextRun),
            spacing: { after: 40 },
          }));
        } else if (line.trim() === '') {
          contenido.push(new Paragraph({ text: '', spacing: { after: 80 } }));
        } else {
          contenido.push(new Paragraph({
            children: this.parseLine(line, TextRun),
            spacing: { after: 80 },
          }));
        }
      }

      const pie = new Paragraph({
        children: [new TextRun({
          text: 'Este análisis es orientativo y generado por inteligencia artificial. '
              + 'No reemplaza el criterio clínico del médico veterinario ni constituye un diagnóstico definitivo.',
          italics: true,
          color: '999999',
          size: 18,
        })],
        border: { top: { color: 'CCCCCC', space: 1, style: BorderStyle.SINGLE, size: 4 } },
        spacing: { before: 240 },
      });

      const doc = new Document({
        sections: [{
          properties: {
            page: { margin: { top: 1440, right: 1080, bottom: 1440, left: 1080 } },
          },
          children: [...encabezado, ...contenido, pie],
        }],
      });

      const blob = await Packer.toBlob(doc);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `diagnostico_ia_${nombre.replace(/\s+/g, '_')}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      this.descargando.set(false);
    }
  }

  private parseLine(text: string, TextRun: any): any[] {
    const parts: any[] = [];
    const regex = /\*\*(.+?)\*\*/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      if (m.index > last) parts.push(new TextRun({ text: text.slice(last, m.index) }));
      parts.push(new TextRun({ text: m[1], bold: true }));
      last = m.index + m[0].length;
    }
    if (last < text.length) parts.push(new TextRun({ text: text.slice(last) }));
    return parts.length ? parts : [new TextRun({ text: ' ' })];
  }

  async analizar(): Promise<void> {
    if (!this.todasConsultas.length) return;

    this.streamSub?.unsubscribe();
    this.analizando.set(true);
    this.streaming.set(false);
    this.texto.set('');
    this.error.set(null);
    this.escenario.set('');

    let formData: FormData;
    try {
      formData = await this.buildFormData();
    } catch {
      this.error.set('No se pudieron cargar los archivos de la consulta.');
      this.analizando.set(false);
      return;
    }

    this.streaming.set(true);
    this.analizando.set(false);

    this.streamSub = this.iaService.analizarStream(formData).subscribe({
      next: evt => {
        if (evt.type === 'meta')   this.escenario.set(evt.escenario);
        if (evt.type === 'chunk')  this.texto.update(t => t + evt.text);
      },
      error: () => {
        this.error.set('No se pudo conectar con el asistente de IA. Inténtalo nuevamente.');
        this.streaming.set(false);
      },
      complete: () => this.streaming.set(false),
    });
  }

  private async buildFormData(): Promise<FormData> {
    const fd = new FormData();
    const consultas = this.todasConsultas;

    const edadMeses = this.hc.edadAproximadaMeses ?? 0;
    const edadStr   = edadMeses >= 12
      ? `${Math.floor(edadMeses / 12)} año(s)${edadMeses % 12 ? ` y ${edadMeses % 12} mes(es)` : ''}`
      : `${edadMeses} mes(es)`;

    const historialCompleto = consultas.map((uc, i) => [
      `=== CONSULTA ${i + 1} — ${this.formatFecha(uc.fechaConsulta)} ===`,
      uc.motivoConsulta,
      uc.anamnesis      ? `Anamnesis: ${uc.anamnesis}` : '',
      uc.examenFisico   ? `Examen físico: ${uc.examenFisico}` : '',
      uc.observaciones  ? `Observaciones: ${uc.observaciones}` : '',
      uc.pesoEnConsulta ? `Peso: ${uc.pesoEnConsulta} kg` : '',
      uc.temperatura    ? `Temperatura: ${uc.temperatura}°C` : '',
      uc.diagnosticos.length   ? `Diagnósticos: ${uc.diagnosticos.map(d => d.nombre).join(', ')}` : '',
      uc.prescripciones.length ? `Medicación: ${uc.prescripciones.map(p => `${p.medicamento} ${p.dosis}`).join(', ')}` : '',
    ].filter(Boolean).join('\n')).join('\n\n');

    fd.append('motivo_consulta', historialCompleto);
    fd.append('especie', this.hc.especie ?? 'Perro');
    fd.append('edad',    edadStr);
    if (this.hc.mascotaNombre) fd.append('nombre_paciente', this.hc.mascotaNombre);
    if (this.hc.sexo) fd.append('sexo', this.hc.sexo);

    const conPeso = consultas.find(c => c.pesoEnConsulta);
    if (conPeso?.pesoEnConsulta) fd.append('peso', `${conPeso.pesoEnConsulta} kg`);

    for (const archivo of this.archivosLab) {
      const file = await this.fetchAsFile(archivo);
      fd.append('archivo_hemograma', file, file.name);
    }
    for (const archivo of this.archivosRadio) {
      const file = await this.fetchAsFile(archivo);
      fd.append('archivo_radiografia', file, file.name);
    }

    return fd;
  }

  private async fetchAsFile(archivo: ArchivoClinico): Promise<File> {
    const url  = this.mediaService.resolveUrl(archivo.url)!;
    const blob = await firstValueFrom(
      this.http.get(url, { responseType: 'blob' })
    );
    return new File([blob], archivo.nombre, {
      type: archivo.tipoMime ?? blob.type ?? 'application/octet-stream',
    });
  }

  formatFecha(fecha: string): string {
    if (!fecha) return '—';
    return new Date(fecha).toLocaleDateString('es-PE', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }
}
