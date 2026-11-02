import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { CompanyComplianceService } from '../../../../core/services/company-compliance.service';
import { LegalService } from '../../../../core/services/legal.service';
import { LegalDocumentDTO } from '../../../../models/legal/legal.model';
import {
  ControlCumplimiento,
  DetalleCumplimientoClinica,
  ModoGestionCumplimiento,
  SolicitudCambioCumplimiento
} from '../../../../models/privacy/company-compliance.model';

interface ControlPresentacion {
  nombre: string;
  descripcion: string;
  caracter: string;
  icono: string;
}

const CONTROLES: Record<ControlCumplimiento, ControlPresentacion> = {
  AVISO_PRIVACIDAD: {
    nombre: 'Aviso de privacidad de la clínica',
    descripcion: 'Informa a propietarios, autorizados, trabajadores y usuarios cómo se tratarán sus datos.',
    caracter: 'Obligatorio cuando la clínica registra datos personales',
    icono: 'pi pi-file'
  },
  DERECHOS_DATOS: {
    nombre: 'Derechos sobre datos personales',
    descripcion: 'Canal para atender solicitudes de acceso, rectificación, oposición y portabilidad.',
    caracter: 'Obligatorio',
    icono: 'pi pi-id-card'
  },
  RECORDATORIOS_CORREO: {
    nombre: 'Recordatorios preventivos por correo',
    descripcion: 'Registra la decisión del propietario antes de enviar recordatorios de vacunas o desparasitación.',
    caracter: 'Opcional para la persona',
    icono: 'pi pi-envelope'
  },
  USO_IA: {
    nombre: 'Uso de inteligencia artificial',
    descripcion: 'Controla la autorización para procesar datos clínicos mediante funciones de IA.',
    caracter: 'Opcional para la persona',
    icono: 'pi pi-sparkles'
  },
  CONSENTIMIENTO_VETERINARIO: {
    nombre: 'Consentimiento informado veterinario',
    descripcion: 'Conserva la decisión y la versión exacta informada antes de un procedimiento veterinario.',
    caracter: 'Según el procedimiento',
    icono: 'pi pi-file-edit'
  }
};

@Component({
  selector: 'app-cumplimiento-clinica',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ToastModule],
  providers: [MessageService],
  templateUrl: './cumplimiento-clinica.component.html'
})
export class CumplimientoClinicaComponent implements OnInit {
  private readonly compliance = inject(CompanyComplianceService);
  private readonly legal = inject(LegalService);
  private readonly fb = inject(FormBuilder);
  private readonly messages = inject(MessageService);

  readonly configuraciones = signal<DetalleCumplimientoClinica[]>([]);
  readonly documentosGlobales = signal<LegalDocumentDTO[]>([]);
  readonly solicitudes = signal<SolicitudCambioCumplimiento[]>([]);
  readonly cargando = signal(true);
  readonly enviando = signal(false);
  readonly controlSeleccionado = signal<DetalleCumplimientoClinica | null>(null);
  readonly pendientes = computed(() => this.solicitudes().filter(s => s.estado === 'PENDIENTE' || s.estado === 'EN_REVISION'));

  readonly modos: { valor: ModoGestionCumplimiento; etiqueta: string }[] = [
    { valor: 'SOFTVET', etiqueta: 'Gestionado en SoftVet' },
    { valor: 'EXTERNO', etiqueta: 'Gestionado externamente' },
    { valor: 'NO_APLICA', etiqueta: 'No aplica' }
  ];

  readonly form = this.fb.nonNullable.group({
    modo: ['SOFTVET' as ModoGestionCumplimiento, Validators.required],
    bloqueante: [false],
    motivo: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(2000)]],
    evidenciaReferencia: ['', Validators.maxLength(200)],
    vigenteDesde: ['']
  });

  ngOnInit(): void {
    this.cargar();
    this.form.controls.modo.valueChanges.subscribe(modo => {
      if (modo !== 'SOFTVET') this.form.controls.bloqueante.setValue(false, { emitEvent: false });
    });
  }

  cargar(): void {
    this.cargando.set(true);
    let pendientes = 3;
    const terminar = () => { pendientes -= 1; if (pendientes === 0) this.cargando.set(false); };
    this.compliance.detalleDeMiClinica().subscribe({
      next: r => { this.configuraciones.set(r.data ?? []); terminar(); },
      error: () => { terminar(); this.error('No se pudo cargar la configuración de la clínica.'); }
    });
    this.compliance.solicitudesDeMiClinica().subscribe({
      next: r => { this.solicitudes.set(r.data ?? []); terminar(); },
      error: () => terminar()
    });
    this.legal.getCurrentDocuments().subscribe({
      next: r => { this.documentosGlobales.set(r.data ?? []); terminar(); },
      error: () => terminar()
    });
  }

  presentacion(control: ControlCumplimiento): ControlPresentacion {
    return CONTROLES[control];
  }

  modoVisible(modo: ModoGestionCumplimiento): string {
    return this.modos.find(m => m.valor === modo)?.etiqueta ?? modo;
  }

  estadoVisible(configuracion: DetalleCumplimientoClinica): string {
    return configuracion.habilitado ? 'Habilitado' : 'No aplica';
  }

  solicitudPendiente(control: ControlCumplimiento): SolicitudCambioCumplimiento | undefined {
    return this.pendientes().find(s => s.control === control);
  }

  abrirSolicitud(configuracion: DetalleCumplimientoClinica): void {
    if (this.solicitudPendiente(configuracion.control)) return;
    this.controlSeleccionado.set(configuracion);
    this.form.reset({ modo: configuracion.modo, bloqueante: configuracion.bloqueante, motivo: '', evidenciaReferencia: '', vigenteDesde: '' });
  }

  cerrarSolicitud(): void {
    if (!this.enviando()) this.controlSeleccionado.set(null);
  }

  enviarSolicitud(): void {
    const control = this.controlSeleccionado();
    if (!control || this.enviando()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const valor = this.form.getRawValue();
    if (valor.modo === 'EXTERNO' && !valor.evidenciaReferencia.trim()) {
      this.form.controls.evidenciaReferencia.setErrors({ required: true });
      this.form.controls.evidenciaReferencia.markAsTouched();
      return;
    }
    const habilitado = valor.modo !== 'NO_APLICA';
    this.enviando.set(true);
    this.compliance.solicitarCambio({
      control: control.control,
      habilitado,
      modo: valor.modo,
      bloqueante: habilitado && valor.modo === 'SOFTVET' && valor.bloqueante,
      motivo: valor.motivo.trim(),
      evidenciaReferencia: valor.evidenciaReferencia.trim() || null,
      vigenteDesde: valor.vigenteDesde ? `${valor.vigenteDesde}:00` : null
    }).subscribe({
      next: ({ data }) => {
        this.solicitudes.update(lista => [data, ...lista]);
        this.enviando.set(false);
        this.controlSeleccionado.set(null);
        this.messages.add({ severity: 'success', summary: 'Solicitud enviada', detail: 'El administrador de plataforma podrá revisarla.' });
      },
      error: error => {
        this.enviando.set(false);
        this.error(error.error?.message ?? 'No se pudo enviar la solicitud.');
      }
    });
  }

  private error(mensaje: string): void {
    this.messages.add({ severity: 'error', summary: 'No se pudo completar', detail: mensaje });
  }
}
