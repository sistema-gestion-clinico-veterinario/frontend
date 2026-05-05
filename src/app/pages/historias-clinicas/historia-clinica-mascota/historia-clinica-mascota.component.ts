import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { HistoriaClinicaService } from '../../../core/services/historia-clinica.service';
import { LoadingStore } from '../../../store/loading.store';
import {
  HistoriaClinicaDetalle,
  ConsultaResumen
} from '../../../models/response/historia-clinica-response';

@Component({
  selector: 'app-historia-clinica-mascota',
  standalone: true,
  imports: [CommonModule, ToastModule],
  providers: [MessageService],
  templateUrl: './historia-clinica-mascota.component.html'
})
export class HistoriaClinicaMascotaComponent implements OnInit {
  private readonly route      = inject(ActivatedRoute);
  private readonly router     = inject(Router);
  private readonly hcService  = inject(HistoriaClinicaService);
  private readonly msgService = inject(MessageService);
  readonly loadingStore       = inject(LoadingStore);

  hc               = signal<HistoriaClinicaDetalle | null>(null);
  consultaActiva   = signal<ConsultaResumen | null>(null);
  tabActiva        = signal<'clinico' | 'recetas' | 'archivos'>('clinico');
  noTieneHc        = signal<boolean>(false);

  ngOnInit() {
    const mascotaId = Number(this.route.snapshot.paramMap.get('mascotaId'));
    this.loadingStore.show();
    this.hcService.getPorMascota(mascotaId).subscribe({
      next: (res) => {
        this.hc.set(res.data);
        if (res.data.consultas.length > 0) {
          this.consultaActiva.set(res.data.consultas[0]);
        }
        this.loadingStore.hide();
      },
      error: (err) => {
        this.loadingStore.hide();
        if (err.status === 404) {
          this.noTieneHc.set(true);
        } else {
          this.msgService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar la historia clínica' });
        }
      }
    });
  }

  seleccionarConsulta(consulta: ConsultaResumen) {
    this.consultaActiva.set(consulta);
    this.tabActiva.set('clinico');
  }

  volver() {
    this.router.navigate(['/mascotas']);
  }

  formatFecha(fecha: string): string {
    if (!fecha) return '—';
    return new Date(fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  formatFechaHora(fecha: string): string {
    if (!fecha) return '—';
    return new Date(fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  edadTexto(meses: number | undefined): string {
    if (!meses) return '—';
    if (meses >= 12) {
      const años = Math.floor(meses / 12);
      return `${años} año${años > 1 ? 's' : ''}`;
    }
    return `${meses} mes${meses > 1 ? 'es' : ''}`;
  }

  tipoConsultaLabel(tipo: string): string {
    const map: Record<string, string> = {
      CONSULTA_GENERAL: 'General',
      URGENCIA: 'Urgencia',
      CONTROL: 'Control',
      CIRUGIA: 'Cirugía',
      VACUNACION: 'Vacunación',
      DESPARASITACION: 'Desparasitación'
    };
    return map[tipo] ?? tipo;
  }

  tipoArchivoLabel(tipo: string): string {
    const map: Record<string, string> = {
      IMAGEN: 'Imagen',
      PDF: 'PDF',
      LABORATORIO: 'Laboratorio',
      RADIOGRAFIA: 'Radiografía',
      ECOGRAFIA: 'Ecografía',
      OTRO: 'Otro'
    };
    return map[tipo] ?? tipo;
  }

  tipoArchivoBadge(tipo: string): string {
    switch (tipo) {
      case 'RADIOGRAFIA': return 'bg-violet-50 text-violet-700';
      case 'LABORATORIO': return 'bg-amber-50 text-amber-700';
      case 'ECOGRAFIA':   return 'bg-teal-50 text-teal-700';
      case 'PDF':         return 'bg-red-50 text-red-600';
      case 'IMAGEN':      return 'bg-blue-50 text-blue-700';
      default:            return 'bg-slate-100 text-slate-500';
    }
  }

  formatBytes(bytes: number | undefined): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
