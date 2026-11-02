import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { CompanyComplianceService } from '../../../core/services/company-compliance.service';
import { CompanyService } from '../../../core/services/company.service';
import { PendientesPrivacidadService } from '../../../core/services/pendientes-privacidad.service';
import { ConfiguracionCumplimiento, ControlCumplimiento, EstadoSolicitudCambioCumplimiento, SolicitudCambioCumplimiento } from '../../../models/privacy/company-compliance.model';

@Component({
  selector: 'app-compliance-requests',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ToastModule],
  providers: [MessageService],
  templateUrl: './compliance-requests.component.html'
})
export class ComplianceRequestsComponent implements OnInit {
  private readonly service = inject(CompanyComplianceService);
  private readonly companiesService = inject(CompanyService);
  private readonly fb = inject(FormBuilder);
  private readonly messages = inject(MessageService);
  private readonly pendientes = inject(PendientesPrivacidadService);

  readonly solicitudes = signal<SolicitudCambioCumplimiento[]>([]);
  readonly empresas = signal<{ id: number; name: string }[]>([]);
  readonly cargando = signal(false);
  readonly total = signal(0);
  readonly activas = signal(0);
  readonly page = signal(0);
  readonly size = signal(10);
  readonly seleccionada = signal<SolicitudCambioCumplimiento | null>(null);
  readonly procesando = signal(false);
  readonly historial = signal<ConfiguracionCumplimiento[]>([]);
  readonly historialEmpresa = signal<string | null>(null);

  readonly filtros = this.fb.nonNullable.group({
    companyId: [''], control: [''], estado: [''], desde: [''], hasta: ['']
  });
  readonly resolucion = this.fb.nonNullable.group({
    comentario: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(2000)]],
    confirmoRevisionLegal: [false]
  });

  readonly controles: { value: ControlCumplimiento; label: string }[] = [
    { value: 'AVISO_PRIVACIDAD', label: 'Aviso de privacidad' },
    { value: 'DERECHOS_DATOS', label: 'Derechos sobre datos' },
    { value: 'USO_IA', label: 'Uso de inteligencia artificial' },
    { value: 'RECORDATORIOS_CORREO', label: 'Recordatorios por correo' },
    { value: 'CONSENTIMIENTO_VETERINARIO', label: 'Consentimiento veterinario' }
  ];
  readonly estados: { value: EstadoSolicitudCambioCumplimiento; label: string }[] = [
    { value: 'PENDIENTE', label: 'Pendiente' }, { value: 'EN_REVISION', label: 'En revisión' },
    { value: 'APROBADA', label: 'Aprobada' }, { value: 'RECHAZADA', label: 'Rechazada' }
  ];

  ngOnInit(): void {
    this.companiesService.listar(0, 1000).subscribe(r => this.empresas.set(
      (r.data?.content ?? []).map(c => ({ id: c.id, name: c.name }))));
    this.actualizarContador();
    this.cargar();
  }

  cargar(reset = false): void {
    if (reset) this.page.set(0);
    const f = this.filtros.getRawValue();
    this.cargando.set(true);
    this.service.bandejaGlobal({
      companyId: f.companyId ? Number(f.companyId) : null,
      control: f.control as ControlCumplimiento | '',
      estado: f.estado as EstadoSolicitudCambioCumplimiento | '',
      desde: f.desde, hasta: f.hasta, page: this.page(), size: this.size()
    }).subscribe({
      next: r => { this.solicitudes.set(r.data?.content ?? []); this.total.set(r.data?.totalElements ?? 0); this.cargando.set(false); },
      error: () => { this.cargando.set(false); this.messages.add({ severity: 'error', summary: 'No se pudo cargar', detail: 'Inténtalo nuevamente.' }); }
    });
  }

  limpiar(): void { this.filtros.reset({ companyId: '', control: '', estado: '', desde: '', hasta: '' }); this.cargar(true); }
  private actualizarContador(): void {
    this.service.contarSolicitudesActivas().subscribe(r => this.activas.set(r.data ?? 0));
  }
  cambiarPagina(page: number): void { if (page < 0 || page >= this.totalPages()) return; this.page.set(page); this.cargar(); }
  cambiarTamano(event: Event): void { this.size.set(Number((event.target as HTMLSelectElement).value)); this.cargar(true); }
  totalPages(): number { return Math.max(1, Math.ceil(this.total() / this.size())); }

  revisar(s: SolicitudCambioCumplimiento): void {
    if (s.estado === 'EN_REVISION') { this.abrirResolucion(s); return; }
    this.procesando.set(true);
    this.service.iniciarRevision(s.id).subscribe({
      next: r => { this.procesando.set(false); this.abrirResolucion(r.data); this.cargar(); this.actualizarContador(); this.pendientes.refrescar(); },
      error: e => { this.procesando.set(false); this.messages.add({ severity: 'error', summary: 'No se pudo iniciar la revisión', detail: e.error?.message ?? 'Inténtalo nuevamente.' }); }
    });
  }

  private abrirResolucion(s: SolicitudCambioCumplimiento): void {
    this.seleccionada.set(s); this.resolucion.reset({ comentario: '', confirmoRevisionLegal: false });
  }
  cerrar(): void { if (!this.procesando()) this.seleccionada.set(null); }

  resolver(aprobar: boolean): void {
    const s = this.seleccionada();
    if (!s || this.procesando()) return;
    if (this.resolucion.controls.comentario.invalid || (aprobar && !this.resolucion.controls.confirmoRevisionLegal.value)) {
      this.resolucion.markAllAsTouched(); return;
    }
    this.procesando.set(true);
    this.service.resolverSolicitud(s.id, {
      aprobar, comentario: this.resolucion.controls.comentario.value.trim(),
      confirmoRevisionLegal: aprobar && this.resolucion.controls.confirmoRevisionLegal.value
    }).subscribe({
      next: () => {
        this.procesando.set(false); this.seleccionada.set(null); this.cargar(); this.actualizarContador(); this.pendientes.refrescar();
        this.messages.add({ severity: 'success', summary: aprobar ? 'Solicitud aprobada' : 'Solicitud rechazada', detail: aprobar && s.vigenteDesdeSolicitada ? 'La nueva versión quedó programada.' : 'La decisión quedó auditada.' });
      },
      error: e => { this.procesando.set(false); this.messages.add({ severity: 'error', summary: 'No se pudo resolver', detail: e.error?.message ?? 'Inténtalo nuevamente.' }); }
    });
  }

  verHistorial(s: SolicitudCambioCumplimiento): void {
    this.historialEmpresa.set(s.empresa); this.historial.set([]);
    this.service.historial(s.companyId).subscribe({
      next: r => this.historial.set(r.data ?? []),
      error: () => this.messages.add({ severity: 'error', summary: 'No se pudo cargar el historial', detail: 'Inténtalo nuevamente.' })
    });
  }
  cerrarHistorial(): void { this.historialEmpresa.set(null); this.historial.set([]); }
  controlNombre(c: ControlCumplimiento): string { return this.controles.find(x => x.value === c)?.label ?? c; }
  estadoNombre(e: EstadoSolicitudCambioCumplimiento): string { return this.estados.find(x => x.value === e)?.label ?? e; }
}
