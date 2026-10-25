import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { PrivacidadService } from '../../../core/services/privacidad.service';
import { AvisoVersion, CamposAvisoPrivacidad, VistaPreviaAviso } from '../../../models/privacy/privacidad.model';
import { AudienciaAvisoPrivacidad } from '../../../types/privacy/audiencia-aviso-privacidad.type';
import { AuthStore } from '../../../store/auth.store';
import { CompanyComplianceService } from '../../../core/services/company-compliance.service';

@Component({
  selector: 'app-privacidad',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ToastModule],
  providers: [MessageService],
  templateUrl: './privacidad.component.html'
})
export class PrivacidadComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(PrivacidadService);
  private readonly messages = inject(MessageService);
  private readonly authStore = inject(AuthStore);
  private readonly complianceService = inject(CompanyComplianceService);

  gestionAvisoSoftvet = signal<boolean | null>(null);
  readonly puedePublicar = computed(() => this.authStore.activeRolePurpose() === 'COMPANY_ADMIN'
    && this.gestionAvisoSoftvet() === true);

  cargando = signal(true);
  publicando = signal(false);
  vistaPrevia = signal<VistaPreviaAviso | null>(null);
  cargandoVistaPrevia = signal(false);
  historial = signal<AvisoVersion[]>([]);
  vigente = signal<AvisoVersion | null>(null);
  versionConsultada = signal<AvisoVersion | null>(null);
  audiencia = signal<AudienciaAvisoPrivacidad>('PROPIETARIOS_Y_AUTORIZADOS');
  readonly audienciaPropietarios: AudienciaAvisoPrivacidad = 'PROPIETARIOS_Y_AUTORIZADOS';
  readonly audienciaTrabajadores: AudienciaAvisoPrivacidad = 'TRABAJADORES_Y_USUARIOS';
  readonly nombreAudiencia = computed(() => this.audiencia() === this.audienciaPropietarios
    ? 'propietarios y personas autorizadas'
    : 'trabajadores y usuarios internos');

  form = this.fb.nonNullable.group({
    razonSocial: ['', [Validators.required, Validators.maxLength(150)]],
    ruc: ['', [Validators.required, Validators.pattern(/^\d{11}$/)]],
    domicilio: ['', [Validators.required, Validators.maxLength(200)]],
    correoDerechos: ['', [Validators.required, Validators.email, Validators.maxLength(100)]],
    registroBancoDatos: ['', Validators.maxLength(100)],
    encargadoTratamiento: ['', Validators.maxLength(200)],
    finalidades: ['', Validators.required],
    datosObligatorios: ['', Validators.required],
    datosFacultativos: [''],
    destinatarios: ['', Validators.required],
    transferencias: ['', [Validators.required, Validators.maxLength(500)]],
    plazoConservacion: ['', [Validators.required, Validators.maxLength(300)]]
  });

  ngOnInit(): void {
    this.complianceService.actualesDeMiClinica().subscribe({
      next: respuesta => {
        const gestionada = !!respuesta.data.find(c => c.control === 'AVISO_PRIVACIDAD')?.gestionadoPorSoftvet;
        this.gestionAvisoSoftvet.set(gestionada);
        if (!this.puedePublicar()) {
          this.form.disable({ emitEvent: false });
          this.cargarHistorial();
        } else {
          this.cargar();
        }
      },
      error: () => {
        this.gestionAvisoSoftvet.set(false);
        this.form.disable({ emitEvent: false });
        this.cargarHistorial();
      }
    });
  }

  private cargarHistorial(): void {
    this.cargando.set(true);
    this.service.historial(this.audiencia()).subscribe({
      next: ({ data: versiones }) => {
        this.historial.set(versiones ?? []);
        this.vigente.set((versiones ?? []).find(v => v.activo) ?? null);
        this.cargando.set(false);
      },
      error: (error) => {
        this.cargando.set(false);
        this.error(error, 'No se pudo cargar el historial del aviso.');
      }
    });
  }

  cargar(): void {
    this.cargando.set(true);
    this.service.plantilla(this.audiencia()).subscribe({
      next: ({ data }) => {
        this.aplicar(data);
        this.service.historial(this.audiencia()).subscribe({
          next: ({ data: versiones }) => {
            this.historial.set(versiones ?? []);
            this.vigente.set((versiones ?? []).find(v => v.activo) ?? null);
            this.cargando.set(false);
          },
          error: () => this.cargando.set(false)
        });
      },
      error: (error) => {
        this.cargando.set(false);
        this.error(error, 'No se pudo cargar la configuración del aviso.');
      }
    });
  }

  seleccionarAudiencia(audiencia: AudienciaAvisoPrivacidad): void {
    if (this.audiencia() === audiencia || this.publicando() || this.cargandoVistaPrevia()) return;
    this.cerrarVistaPrevia();
    this.audiencia.set(audiencia);
    this.historial.set([]);
    this.vigente.set(null);
    if (this.puedePublicar()) this.cargar();
    else this.cargarHistorial();
  }

  solicitarPublicacion(): void {
    if (!this.puedePublicar()) {
      this.messages.add({ severity: 'warn', summary: 'Acción no permitida', detail: 'Solo el administrador de la clínica puede publicar el aviso de privacidad.' });
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.messages.add({ severity: 'warn', summary: 'Faltan datos por completar', detail: 'Revisa los campos obligatorios antes de continuar.' });
      return;
    }
    this.abrirConfirmacion();
  }

  cerrarVistaPrevia(): void {
    if (this.publicando()) return;
    this.vistaPrevia.set(null);
  }

  abrirVersion(version: AvisoVersion): void {
    this.versionConsultada.set(version);
  }

  cerrarVersion(): void {
    this.versionConsultada.set(null);
  }

  responsableVisible(version: AvisoVersion): string {
    const responsable = version.creadoPor?.trim();
    if (!responsable) return 'Usuario no registrado';
    return responsable.includes('@') ? 'Administrador de la clínica' : responsable;
  }

  confirmarPublicacion(): void {
    const previa = this.vistaPrevia();
    if (!previa || previa.observaciones.length > 0 || previa.sinCambios) return;
    this.publicar();
  }

  private abrirConfirmacion(): void {
    if (!this.puedePublicar() || this.cargandoVistaPrevia()) return;
    this.cargandoVistaPrevia.set(true);
    this.service.vistaPrevia(this.armarCampos(), this.audiencia()).subscribe({
      next: ({ data }) => {
        this.vistaPrevia.set(data);
        this.cargandoVistaPrevia.set(false);
      },
      error: (error) => {
        this.cargandoVistaPrevia.set(false);
        this.error(error, 'No se pudo generar la vista previa.');
      }
    });
  }

  private armarCampos(): CamposAvisoPrivacidad {
    const raw = this.form.getRawValue();
    return {
      razonSocial: raw.razonSocial.trim(),
      ruc: raw.ruc.trim(),
      domicilio: raw.domicilio.trim(),
      correoDerechos: raw.correoDerechos.trim().toLowerCase(),
      registroBancoDatos: raw.registroBancoDatos.trim() || null,
      encargadoTratamiento: raw.encargadoTratamiento.trim() || null,
      finalidades: this.lineas(raw.finalidades),
      datosObligatorios: this.lineas(raw.datosObligatorios),
      datosFacultativos: this.lineas(raw.datosFacultativos),
      destinatarios: this.lineas(raw.destinatarios),
      transferencias: raw.transferencias.trim(),
      plazoConservacion: raw.plazoConservacion.trim()
    };
  }

  private publicar(): void {
    const campos = this.armarCampos();
    this.publicando.set(true);
    // El clic explícito en «Confirmar y publicar» constituye la confirmación
    // de revisión legal que el backend registra junto con la nueva versión.
    this.service.publicar(campos, true, this.audiencia()).subscribe({
      next: ({ data }) => {
        this.vistaPrevia.set(null);
        this.vigente.set(data);
        this.messages.add({ severity: 'success', summary: 'Aviso publicado', detail: `La versión ${data.version} ya está vigente.` });
        this.publicando.set(false);
        this.cargar();
      },
      error: (error) => {
        this.publicando.set(false);
        this.error(error, 'No se pudo publicar el aviso.');
      }
    });
  }

  private aplicar(campos: CamposAvisoPrivacidad): void {
    this.form.patchValue({
      ...campos,
      registroBancoDatos: campos.registroBancoDatos ?? '',
      encargadoTratamiento: campos.encargadoTratamiento ?? '',
      finalidades: (campos.finalidades ?? []).join('\n'),
      datosObligatorios: (campos.datosObligatorios ?? []).join('\n'),
      datosFacultativos: (campos.datosFacultativos ?? []).join('\n'),
      destinatarios: (campos.destinatarios ?? []).join('\n')
    });
  }

  private lineas(value: string): string[] {
    return value.split(/\r?\n/).map(v => v.trim()).filter(Boolean);
  }

  private error(error: any, fallback: string): void {
    this.messages.add({ severity: 'error', summary: 'No se pudo completar', detail: error?.error?.message ?? fallback });
  }
}
