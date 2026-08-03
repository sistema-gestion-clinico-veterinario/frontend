import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { HistoriaClinicaService } from '../../../core/services/historia-clinica.service';
import { CitaService } from '../../../core/services/cita.service';
import { LoadingStore } from '../../../store/loading.store';
import { AuthStore } from '../../../store/auth.store';
import {
  HistoriaClinicaDetalle,
  ConsultaResumen,
  ArchivoClinico
} from '../../../models/response/historia-clinica-response';
import { ArchivoClinicoResponse } from '../../../models/response/archivo-clinico-response';
import { CitaResponse } from '../../../models/response/cita-response';
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
  private readonly route        = inject(ActivatedRoute);
  private readonly router       = inject(Router);
  private readonly hcService    = inject(HistoriaClinicaService);
  private readonly citaService  = inject(CitaService);
  private readonly msgService   = inject(MessageService);
  private readonly sanitizer    = inject(DomSanitizer);
  readonly loadingStore         = inject(LoadingStore);
  readonly authStore            = inject(AuthStore);

  readonly canModify = computed(() => this.authStore.hasAccess('VISTA_HISTORIAS', 'modificar'));

  returnUrl           = '/historias-clinicas';
  mascotaId           = 0;
  numeroHc            = '';
  hc                  = signal<HistoriaClinicaDetalle | null>(null);
  consultaActiva      = signal<ConsultaResumen | null>(null);
  seccionActiva       = signal<'consultas' | 'servicios' | 'preventivos'>('consultas');
  tabActiva           = signal<'clinico' | 'recetas' | 'archivos'>('clinico');
  noTieneHc           = signal<boolean>(false);
  serviciosNoMedicos  = signal<CitaResponse[]>([]);
  loadingServicios    = signal(false);

  previewArchivo   = signal<ArchivoClinicoResponse | null>(null);
  previewUrl       = signal<SafeResourceUrl | string>('');
  previewRawUrl    = signal<string>('');
  previewTipo      = signal<'imagen' | 'pdf' | 'dcm' | 'docx' | null>(null);
  previewCargando  = signal<boolean>(false);

  ngOnInit() {
    this.route.queryParamMap.subscribe(qp => {
      if (qp.get('returnUrl')) this.returnUrl = qp.get('returnUrl')!;
    });
    this.route.params.subscribe(params => {
      this.numeroHc = params['numeroHc'];
      this.cargarHistoria(this.numeroHc);
    });
  }

  cargarHistoria(numeroHc: string) {
    this.loadingStore.show();
    this.hcService.getPorNumeroHc(numeroHc).subscribe({
      next: (res) => {
        this.mascotaId = res.data.mascotaId;
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
    this.seccionActiva.set('consultas');
  }

  seleccionarTab(tab: 'clinico' | 'recetas' | 'archivos') {
    this.tabActiva.set(tab);
  }

  seleccionarSeccion(seccion: 'consultas' | 'servicios' | 'preventivos') {
    this.seccionActiva.set(seccion);
    if (seccion === 'servicios' && this.mascotaId && this.serviciosNoMedicos().length === 0) {
      this.cargarServicios();
    }
  }

  cargarServicios() {
    this.loadingServicios.set(true);
    this.citaService.getServiciosNoMedicos(this.mascotaId).subscribe({
      next: (res) => {
        this.serviciosNoMedicos.set(res.data ?? []);
        this.loadingServicios.set(false);
      },
      error: () => this.loadingServicios.set(false)
    });
  }

  editarConsulta(id: number) {
    if (!this.canModify()) return;
    this.router.navigate(['/historias-clinicas/consulta', id], {
      queryParams: {
        returnUrl: '/historias-clinicas/mascota/' + this.numeroHc,
        mode: 'edit'
      }
    });
  }

  volver() {
    this.router.navigateByUrl(this.returnUrl);
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

  estadoCitaBadge(estado: string): string {
    const map: Record<string, string> = {
      COMPLETADA: 'bg-green-50 text-green-700',
      CANCELADA: 'bg-red-50 text-red-600',
      ELIMINADA: 'bg-red-50 text-red-600',
      EN_PROCESO: 'bg-blue-50 text-blue-700',
      PROGRAMADA: 'bg-slate-100 text-slate-600',
      CONFIRMADA: 'bg-indigo-50 text-indigo-700',
      PENDIENTE: 'bg-amber-50 text-amber-700',
      REPROGRAMADA: 'bg-orange-50 text-orange-600',
      SALA_DE_ESPERA: 'bg-cyan-50 text-cyan-700',
      NO_ASISTIO: 'bg-slate-100 text-slate-500',
    };
    return map[estado] ?? 'bg-slate-100 text-slate-600';
  }

  estadoCitaLabel(estado: string): string {
    const map: Record<string, string> = {
      COMPLETADA: 'Completada', CANCELADA: 'Cancelada', EN_PROCESO: 'En proceso',
      PROGRAMADA: 'Programada', CONFIRMADA: 'Confirmada', PENDIENTE: 'Pendiente',
      REPROGRAMADA: 'Reprogramada', SALA_DE_ESPERA: 'En espera',
      NO_ASISTIO: 'No asistió', ELIMINADA: 'Eliminada', OTRO: 'Otro',
    };
    return map[estado] ?? estado;
  }

  tipoArchivoLabel(tipo: string): string {
    const map: Record<string, string> = {
      IMAGEN: 'Imagen',
      PDF: 'PDF',
      LABORATORIO: 'Laboratorio',
      RADIOGRAFIA: 'Radiografía',
      ECOGRAFIA: 'Ecografía',
      DOCUMENTO: 'Documento',
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
      case 'DOCUMENTO':   return 'bg-indigo-50 text-indigo-700';
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

    if (ext === 'docx' || ext === 'doc') {
      this.previewArchivo.set(archivo as unknown as ArchivoClinicoResponse);
      this.previewTipo.set('docx');
      this.previewUrl.set('');
      return;
    }

    this.previewCargando.set(true);
    this.hcService.obtenerContenidoArchivo(consultaId, archivo.id).subscribe({
      next: (blob) => {
        if (this.previewRawUrl()) URL.revokeObjectURL(this.previewRawUrl());
        const mime = archivo.tipoMime || blob.type || 'application/octet-stream';
        const typedBlob = blob.type && blob.type !== 'application/octet-stream' ? blob : new Blob([blob], { type: mime });
        const objectUrl = URL.createObjectURL(typedBlob);
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
