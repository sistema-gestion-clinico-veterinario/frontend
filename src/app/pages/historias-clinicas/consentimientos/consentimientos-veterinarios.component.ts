import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ESTADO_DE_CONSENTIMIENTO } from '../../../core/constants/consentimiento-veterinario.constants';
import { ConsentimientoVeterinarioService } from '../../../core/services/consentimiento-veterinario.service';
import {
  ConsentimientoVeterinario,
  CrearConsentimientoVeterinario,
  EstadoConsentimientoVeterinario
} from '../../../models/privacy/consentimiento-veterinario.model';

interface CampoDeTexto {
  control: keyof CrearConsentimientoVeterinario;
  etiqueta: string;
  max: number;
  filas: number;
}

@Component({
  selector: 'app-consentimientos-veterinarios',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ToastModule],
  providers: [MessageService],
  templateUrl: './consentimientos-veterinarios.component.html'
})
export class ConsentimientosVeterinariosComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ConsentimientoVeterinarioService);
  private readonly messages = inject(MessageService);

  readonly items = signal<ConsentimientoVeterinario[]>([]);
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly trabajando = signal(false);

  readonly camposDeTexto: CampoDeTexto[] = [
    { control: 'diagnosticoIndicacion', etiqueta: 'Diagnóstico o indicación', max: 5000, filas: 3 },
    { control: 'descripcionProcedimiento', etiqueta: 'Descripción del procedimiento', max: 8000, filas: 4 },
    { control: 'beneficiosEsperados', etiqueta: 'Beneficios esperados', max: 5000, filas: 4 },
    { control: 'riesgosPrevisibles', etiqueta: 'Riesgos previsibles', max: 8000, filas: 4 },
    { control: 'alternativas', etiqueta: 'Alternativas', max: 5000, filas: 4 },
    { control: 'consecuenciasNoRealizar', etiqueta: 'Consecuencias de no realizarlo', max: 5000, filas: 4 }
  ];

  readonly procedimientoMax = 200;

  readonly form = this.fb.nonNullable.group({
    mascotaId: [null as number | null, [Validators.required, Validators.min(1)]],
    apoderadoId: [null as number | null, [Validators.required, Validators.min(1)]],
    consultaId: [null as number | null, [Validators.min(1)]],
    procedimiento: ['', [Validators.required, Validators.maxLength(this.procedimientoMax), this.noSoloEspacios]],
    diagnosticoIndicacion: ['', [Validators.required, Validators.maxLength(5000), this.noSoloEspacios]],
    descripcionProcedimiento: ['', [Validators.required, Validators.maxLength(8000), this.noSoloEspacios]],
    beneficiosEsperados: ['', [Validators.required, Validators.maxLength(5000), this.noSoloEspacios]],
    riesgosPrevisibles: ['', [Validators.required, Validators.maxLength(8000), this.noSoloEspacios]],
    alternativas: ['', [Validators.required, Validators.maxLength(5000), this.noSoloEspacios]],
    consecuenciasNoRealizar: ['', [Validators.required, Validators.maxLength(5000), this.noSoloEspacios]],
    autorizacionAnestesia: [false],
    autorizacionEmergencia: [false]
  });

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    this.service.listar().subscribe({
      next: respuesta => {
        this.items.set(respuesta.data ?? []);
        this.cargando.set(false);
      },
      error: err => {
        this.error.set(err.error?.message ?? 'No se pudieron cargar los consentimientos.');
        this.cargando.set(false);
      }
    });
  }

  crear(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.trabajando()) return;

    const valores = this.form.getRawValue();
    const solicitud: CrearConsentimientoVeterinario = {
      mascotaId: valores.mascotaId as number,
      apoderadoId: valores.apoderadoId as number,
      consultaId: valores.consultaId || null,
      procedimiento: valores.procedimiento.trim(),
      diagnosticoIndicacion: valores.diagnosticoIndicacion.trim(),
      descripcionProcedimiento: valores.descripcionProcedimiento.trim(),
      beneficiosEsperados: valores.beneficiosEsperados.trim(),
      riesgosPrevisibles: valores.riesgosPrevisibles.trim(),
      alternativas: valores.alternativas.trim(),
      consecuenciasNoRealizar: valores.consecuenciasNoRealizar.trim(),
      autorizacionAnestesia: valores.autorizacionAnestesia,
      autorizacionEmergencia: valores.autorizacionEmergencia
    };

    this.trabajando.set(true);
    this.service.crear(solicitud).subscribe({
      next: () => {
        this.trabajando.set(false);
        this.form.reset();
        this.messages.add({
          severity: 'success',
          summary: 'Documento emitido',
          detail: 'Quedó disponible para que el autorizado decida.'
        });
        this.cargar();
      },
      error: err => {
        this.trabajando.set(false);
        this.messages.add({
          severity: 'error',
          summary: 'No se pudo emitir el documento',
          detail: err.error?.message ?? 'Revisa los datos e inténtalo nuevamente.'
        });
      }
    });
  }

  invalido(control: string): boolean {
    const campo = this.form.get(control);
    return !!campo && campo.invalid && campo.touched;
  }

  longitud(control: string): number {
    return String(this.form.get(control)?.value ?? '').length;
  }

  etiquetaDeEstado(estado: EstadoConsentimientoVeterinario): string {
    return ESTADO_DE_CONSENTIMIENTO[estado]?.etiqueta ?? estado;
  }

  clasesDeEstado(estado: EstadoConsentimientoVeterinario): string {
    return ESTADO_DE_CONSENTIMIENTO[estado]?.clases ?? 'border-slate-200 bg-slate-50 text-slate-700';
  }

  private noSoloEspacios(control: { value: unknown }): { soloEspacios: true } | null {
    return typeof control.value === 'string' && control.value.length > 0 && !control.value.trim()
      ? { soloEspacios: true }
      : null;
  }
}
