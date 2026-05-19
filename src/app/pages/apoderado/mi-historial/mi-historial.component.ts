import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { ApoderadoService } from '../../../core/services/apoderado.service';
import { LoadingStore } from '../../../store/loading.store';

@Component({
  selector: 'app-mi-historial',
  standalone: true,
  imports: [CommonModule, ToastModule],
  providers: [MessageService],
  templateUrl: './mi-historial.component.html'
})
export class MiHistorialComponent implements OnInit {
  private readonly route      = inject(ActivatedRoute);
  private readonly location   = inject(Location);
  private readonly apoderado  = inject(ApoderadoService);
  private readonly msgService = inject(MessageService);
  readonly loadingStore       = inject(LoadingStore);

  // Mascotas del apoderado (panel izquierdo)
  mascotas        = signal<any[]>([]);
  mascotaActiva   = signal<any | null>(null);

  // Historia clínica (panel derecho)
  hc             = signal<any | null>(null);
  consultaActiva = signal<any | null>(null);
  tabActiva      = signal<'clinico' | 'recetas' | 'archivos'>('clinico');
  noTieneHc      = signal<boolean>(false);
  loadingHc      = signal<boolean>(false);

  ngOnInit() {
    // Si viene con :mascotaId en la URL, pre-selecciona esa mascota
    this.route.params.subscribe(params => {
      this.cargarMascotas(params['mascotaId'] ? Number(params['mascotaId']) : null);
    });
  }

  cargarMascotas(preselectedId: number | null) {
    this.loadingStore.show();
    this.apoderado.getPortalMascotas().subscribe({
      next: (res: any) => {
        this.mascotas.set(res.data || []);
        this.loadingStore.hide();
        if (preselectedId) {
          const pre = (res.data || []).find((m: any) => m.id === preselectedId);
          if (pre) this.seleccionarMascota(pre);
        } else if (res.data?.length === 1) {
          // Solo una mascota → la selecciona automáticamente
          this.seleccionarMascota(res.data[0]);
        }
      },
      error: () => {
        this.loadingStore.hide();
        this.msgService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar tus mascotas.' });
      }
    });
  }

  seleccionarMascota(mascota: any) {
    if (this.mascotaActiva()?.id === mascota.id) return;
    this.mascotaActiva.set(mascota);
    this.hc.set(null);
    this.noTieneHc.set(false);
    this.consultaActiva.set(null);
    this.cargarHistoria(mascota.id);
  }

  cargarHistoria(mascotaId: number) {
    this.loadingHc.set(true);
    this.apoderado.getPortalMascotaHistoria(mascotaId).subscribe({
      next: (res: any) => {
        this.hc.set(res.data);
        if (res.data?.consultas?.length > 0) {
          this.consultaActiva.set(res.data.consultas[0]);
        }
        this.loadingHc.set(false);
      },
      error: (err: any) => {
        this.loadingHc.set(false);
        if (err.status === 404) this.noTieneHc.set(true);
        else this.msgService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar la historia clínica.' });
      }
    });
  }

  seleccionarConsulta(consulta: any) {
    this.consultaActiva.set(consulta);
    this.tabActiva.set('clinico');
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
    if (meses >= 12) { const a = Math.floor(meses / 12); return `${a} año${a > 1 ? 's' : ''}`; }
    return `${meses} mes${meses > 1 ? 'es' : ''}`;
  }

  tipoConsultaLabel(tipo: string): string {
    const map: Record<string, string> = {
      CONSULTA_GENERAL: 'General', URGENCIA: 'Urgencia', CONTROL: 'Control',
      CIRUGIA: 'Cirugía', VACUNACION: 'Vacunación', DESPARASITACION: 'Desparasitación'
    };
    return map[tipo] ?? tipo;
  }

  tipoArchivoLabel(tipo: string): string {
    const map: Record<string, string> = {
      IMAGEN: 'Imagen', PDF: 'PDF', LABORATORIO: 'Laboratorio',
      RADIOGRAFIA: 'Radiografía', ECOGRAFIA: 'Ecografía', OTRO: 'Otro'
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
