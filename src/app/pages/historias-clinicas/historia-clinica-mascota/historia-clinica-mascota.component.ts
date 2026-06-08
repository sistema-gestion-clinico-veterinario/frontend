import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { HistoriaClinicaService } from '../../../core/services/historia-clinica.service';
import { LoadingStore } from '../../../store/loading.store';
import { AuthStore } from '../../../store/auth.store';
import {
  HistoriaClinicaDetalle,
  ConsultaResumen,
  ArchivoClinico
} from '../../../models/response/historia-clinica-response';
import { ArchivoClinicoResponse } from '../../../models/response/archivo-clinico-response';
import { ArchivoModalsComponent } from '../form-hc/archivo-modals/archivo-modals.component';
import { DiagnosticoIaComponent } from './diagnostico-ia/diagnostico-ia.component';

@Component({
  selector: 'app-historia-clinica-mascota',
  standalone: true,
  imports: [CommonModule, ToastModule, ArchivoModalsComponent, DiagnosticoIaComponent],
  providers: [MessageService],
  templateUrl: './historia-clinica-mascota.component.html'
})
export class HistoriaClinicaMascotaComponent implements OnInit {
  private readonly route      = inject(ActivatedRoute);
  private readonly router     = inject(Router);
  private readonly location   = inject(Location);
  private readonly hcService  = inject(HistoriaClinicaService);
  private readonly msgService = inject(MessageService);
  private readonly sanitizer  = inject(DomSanitizer);
  readonly loadingStore       = inject(LoadingStore);
  readonly authStore          = inject(AuthStore);

  readonly canModify = computed(() => this.authStore.hasAccess('VISTA_HISTORIAS', 'modificar'));

  mascotaId        = 0;
  hc               = signal<HistoriaClinicaDetalle | null>(null);
  consultaActiva   = signal<ConsultaResumen | null>(null);
  tabActiva        = signal<'clinico' | 'recetas' | 'archivos'>('clinico');
  noTieneHc        = signal<boolean>(false);

  previewArchivo   = signal<ArchivoClinicoResponse | null>(null);
  previewUrl       = signal<SafeResourceUrl | string>('');
  previewRawUrl    = signal<string>('');
  previewTipo      = signal<'imagen' | 'pdf' | 'dcm' | null>(null);
  previewCargando  = signal<boolean>(false);

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.mascotaId = Number(params['mascotaId']);
      this.cargarHistoria(this.mascotaId);
    });
  }

  cargarHistoria(mascotaId: number) {
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

  editarConsulta(id: number) {
    if (!this.canModify()) return;
    this.router.navigate(['/historias-clinicas/consulta', id], { queryParams: { returnUrl: '/historias-clinicas/mascota/' + this.mascotaId } });
  }

  volver() {
    this.location.back();
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

  visualizarArchivo(archivo: ArchivoClinico): void {
    const ext = archivo.nombre?.split('.').pop()?.toLowerCase() ?? '';
    const consultaId = this.consultaActiva()?.id;
    if (!consultaId) return;

    if (ext === 'dcm') {
      this.previewArchivo.set(archivo as unknown as ArchivoClinicoResponse);
      this.previewTipo.set('dcm');
      this.previewUrl.set('');
      return;
    }

    this.previewCargando.set(true);
    this.hcService.obtenerContenidoArchivo(consultaId, archivo.id).subscribe({
      next: (blob) => {
        if (this.previewRawUrl()) URL.revokeObjectURL(this.previewRawUrl());
        const objectUrl = URL.createObjectURL(blob);
        this.previewRawUrl.set(objectUrl);
        this.previewUrl.set(ext === 'pdf'
          ? this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl)
          : objectUrl);
        this.previewArchivo.set(archivo as unknown as ArchivoClinicoResponse);
        this.previewTipo.set(ext === 'pdf' ? 'pdf' : 'imagen');
        this.previewCargando.set(false);
      },
      error: () => {
        this.previewCargando.set(false);
        this.msgService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar el archivo' });
      }
    });
  }

  cerrarPreview(): void {
    if (this.previewRawUrl()) URL.revokeObjectURL(this.previewRawUrl());
    this.previewRawUrl.set('');
    this.previewUrl.set('');
    this.previewArchivo.set(null);
    this.previewTipo.set(null);
  }

  descargarArchivo(archivo: ArchivoClinicoResponse): void {
    const consultaId = this.consultaActiva()?.id;
    if (!consultaId) return;
    this.hcService.obtenerContenidoArchivo(consultaId, archivo.id, true).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = archivo.nombre;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.msgService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo descargar el archivo' })
    });
  }
}
