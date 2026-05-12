import { Component, Input, inject, signal, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DiagnosticoIaService } from '../../../../core/services/diagnostico-ia.service';
import {
  DiagnosticoIaRequest,
  DiagnosticoIaResponse
} from '../../../../models/response/diagnostico-ia-response';
import {
  HistoriaClinicaDetalle,
  ConsultaResumen
} from '../../../../models/response/historia-clinica-response';

@Component({
  selector: 'app-diagnostico-ia',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './diagnostico-ia.component.html'
})
export class DiagnosticoIaComponent implements OnChanges {
  @Input() hc!: HistoriaClinicaDetalle;

  private readonly iaService = inject(DiagnosticoIaService);

  abierto    = signal(false);
  analizando = signal(false);
  respuesta  = signal<DiagnosticoIaResponse | null>(null);
  error      = signal<string | null>(null);

  get ultimaConsulta(): ConsultaResumen | null {
    return this.hc?.consultas?.[0] ?? null;
  }

  get tieneHemograma(): boolean {
    return this.ultimaConsulta?.archivos.some(a => a.tipo === 'LABORATORIO') ?? false;
  }

  get tieneRadiografia(): boolean {
    return this.ultimaConsulta?.archivos.some(a => a.tipo === 'RADIOGRAFIA') ?? false;
  }

  get tieneEcografia(): boolean {
    return this.ultimaConsulta?.archivos.some(a => a.tipo === 'ECOGRAFIA') ?? false;
  }

  ngOnChanges(): void {
    this.respuesta.set(null);
    this.error.set(null);
  }

  abrir(): void {
    this.abierto.set(true);
  }

  cerrar(): void {
    this.abierto.set(false);
  }

  analizar(): void {
    const uc = this.ultimaConsulta;
    if (!uc) return;

    this.analizando.set(true);
    this.respuesta.set(null);
    this.error.set(null);

    const request: DiagnosticoIaRequest = {
      mascotaNombre:  this.hc.mascotaNombre,
      especie:        this.hc.especie,
      raza:           this.hc.raza,
      edadMeses:      this.hc.edadAproximadaMeses,
      totalConsultas: this.hc.consultas.length,
      ultimaConsulta: {
        fecha:         uc.fechaConsulta,
        motivo:        uc.motivoConsulta,
        tipo:          uc.tipoConsulta,
        pesoKg:        uc.pesoEnConsulta,
        temperatura:   uc.temperatura,
        frecuenciaCardiaca:     uc.frecuenciaCardiaca,
        frecuenciaRespiratoria: uc.frecuenciaRespiratoria,
        anamnesis:     uc.anamnesis,
        examenFisico:  uc.examenFisico,
        observaciones: uc.observaciones,
        diagnosticosRegistrados: uc.diagnosticos.map(d => d.nombre),
        tratamientosRegistrados: uc.tratamientos.map(t => t.nombre),
        medicamentos:  uc.prescripciones.map(p => p.medicamento),
        tieneHemograma:  this.tieneHemograma,
        tieneRadiografia: this.tieneRadiografia,
        tieneEcografia:  this.tieneEcografia
      }
    };

    this.iaService.analizar(request).subscribe({
      next: (res) => {
        this.respuesta.set(res);
        this.analizando.set(false);
      },
      error: () => {
        this.error.set('No se pudo conectar con el asistente de IA. Inténtalo nuevamente.');
        this.analizando.set(false);
      }
    });
  }

  confianzaLabel(nivel: string): string {
    const map: Record<string, string> = { ALTO: 'Alta', MEDIO: 'Media', BAJO: 'Baja' };
    return map[nivel] ?? nivel;
  }

  confianzaBadge(nivel: string): string {
    switch (nivel) {
      case 'ALTO':  return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'MEDIO': return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'BAJO':  return 'bg-red-50 text-red-600 border border-red-200';
      default:      return 'bg-slate-100 text-slate-500';
    }
  }

  formatFecha(fecha: string): string {
    if (!fecha) return '—';
    return new Date(fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
