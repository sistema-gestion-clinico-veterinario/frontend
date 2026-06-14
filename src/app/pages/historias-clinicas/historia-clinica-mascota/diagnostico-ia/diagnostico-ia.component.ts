import { Component, Input, inject, signal, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { DiagnosticoIaService } from '../../../../core/services/diagnostico-ia.service';
import { ESCENARIO_LABEL } from '../../../../models/response/diagnostico-ia-response';
import {
  HistoriaClinicaDetalle,
  ConsultaResumen,
  ArchivoClinico,
} from '../../../../models/response/historia-clinica-response';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-diagnostico-ia',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './diagnostico-ia.component.html',
})
export class DiagnosticoIaComponent implements OnChanges {
  @Input() hc!: HistoriaClinicaDetalle;

  private readonly iaService = inject(DiagnosticoIaService);
  private streamSub: Subscription | null = null;

  abierto    = signal(false);
  analizando = signal(false);
  streaming  = signal(false);
  error      = signal<string | null>(null);
  texto      = signal('');
  escenario  = signal('');

  get ultimaConsulta(): ConsultaResumen | null {
    return this.hc?.consultas?.[0] ?? null;
  }

  get archivoLab(): ArchivoClinico | null {
    return this.ultimaConsulta?.archivos.find(a => a.tipo === 'LABORATORIO') ?? null;
  }

  get archivoRadio(): ArchivoClinico | null {
    return this.ultimaConsulta?.archivos.find(a => a.tipo === 'RADIOGRAFIA') ?? null;
  }

  get tieneHemograma(): boolean  { return !!this.archivoLab; }
  get tieneRadiografia(): boolean { return !!this.archivoRadio; }
  get tieneEcografia(): boolean {
    return this.ultimaConsulta?.archivos.some(a => a.tipo === 'ECOGRAFIA') ?? false;
  }

  get escenarioLabel(): string {
    return ESCENARIO_LABEL[this.escenario()] ?? this.escenario();
  }

  ngOnChanges(): void {
    this.texto.set('');
    this.error.set('');
    this.escenario.set('');
  }

  abrir(): void  { this.abierto.set(true); }
  cerrar(): void { this.abierto.set(false); }

  async analizar(): Promise<void> {
    const uc = this.ultimaConsulta;
    if (!uc) return;

    this.streamSub?.unsubscribe();
    this.analizando.set(true);
    this.streaming.set(false);
    this.texto.set('');
    this.error.set(null);
    this.escenario.set('');

    let formData: FormData;
    try {
      formData = await this.buildFormData(uc);
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

  private async buildFormData(uc: ConsultaResumen): Promise<FormData> {
    const fd = new FormData();

    const edadMeses = this.hc.edadAproximadaMeses ?? 0;
    const edadStr   = edadMeses >= 12
      ? `${Math.floor(edadMeses / 12)} año(s)${edadMeses % 12 ? ` y ${edadMeses % 12} mes(es)` : ''}`
      : `${edadMeses} mes(es)`;

    const motivoCompleto = [
      uc.motivoConsulta,
      uc.anamnesis      ? `Anamnesis: ${uc.anamnesis}` : '',
      uc.examenFisico   ? `Examen físico: ${uc.examenFisico}` : '',
      uc.observaciones  ? `Observaciones: ${uc.observaciones}` : '',
      uc.diagnosticos.length  ? `Diagnósticos registrados: ${uc.diagnosticos.map(d => d.nombre).join(', ')}` : '',
      uc.prescripciones.length ? `Medicación actual: ${uc.prescripciones.map(p => `${p.medicamento} ${p.dosis}`).join(', ')}` : '',
    ].filter(Boolean).join('\n\n');

    fd.append('motivo_consulta', motivoCompleto);
    fd.append('especie', this.hc.especie ?? 'Perro');
    fd.append('edad',    edadStr);
    if (this.hc.sexo)          fd.append('sexo', this.hc.sexo);
    if (uc.pesoEnConsulta)     fd.append('peso', `${uc.pesoEnConsulta} kg`);

    if (this.archivoLab) {
      const file = await this.fetchAsFile(this.archivoLab);
      fd.append('archivo_hemograma', file, file.name);
    }
    if (this.archivoRadio) {
      const file = await this.fetchAsFile(this.archivoRadio);
      fd.append('archivo_radiografia', file, file.name);
    }

    return fd;
  }

  private async fetchAsFile(archivo: ArchivoClinico): Promise<File> {
    const url = archivo.url.startsWith('http')
      ? archivo.url
      : `${environment.apiUrl}/${archivo.url}`;
    const res  = await fetch(url);
    if (!res.ok) throw new Error(`No se pudo descargar ${archivo.nombre}`);
    const blob = await res.blob();
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
