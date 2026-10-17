import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ESTADO_DE_CONSENTIMIENTO } from '../../../core/constants/consentimiento-veterinario.constants';
import { ConsentimientoVeterinarioService } from '../../../core/services/consentimiento-veterinario.service';
import { ConsentimientoVeterinario, EstadoConsentimientoVeterinario } from '../../../models/privacy/consentimiento-veterinario.model';

const MINIMO_DEL_MOTIVO = 10;

function minimoSinEspacios(minimo: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor = typeof control.value === 'string' ? control.value.trim() : '';
    return control.value && valor.length < minimo ? { minimo: { requerido: minimo, actual: valor.length } } : null;
  };
}

function sinSoloEspacios(control: AbstractControl): ValidationErrors | null {
  return typeof control.value === 'string' && control.value.length > 0 && !control.value.trim() ? { soloEspacios: true } : null;
}

@Component({
  selector: 'app-mis-consentimientos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ToastModule],
  providers: [MessageService],
  templateUrl: './consentimientos.component.html'
})
export class ConsentimientosComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ConsentimientoVeterinarioService);
  private readonly messages = inject(MessageService);

  readonly items = signal<ConsentimientoVeterinario[]>([]);
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly trabajando = signal<string | null>(null);
  readonly avisos = signal<Record<string, string>>({});

  private readonly formularios = new Map<string, FormGroup>();

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.service.listarMios().subscribe({
      next: respuesta => {
        const documentos = respuesta.data ?? [];
        this.items.set(documentos);
        this.prepararFormularios(documentos);
        this.error.set('');
        this.cargando.set(false);
      },
      error: err => {
        this.error.set(err.error?.message ?? 'No se pudieron cargar los consentimientos.');
        this.cargando.set(false);
      }
    });
  }

  formulario(uuid: string): FormGroup {
    return this.formularios.get(uuid) ?? this.crearFormulario();
  }

  decidir(documento: ConsentimientoVeterinario, aceptar: boolean): void {
    const formulario = this.formulario(documento.uuid);
    const { nombre, documento: numero, aclaradas, motivo } = formulario.getRawValue();

    if (formulario.controls['nombre'].invalid || formulario.controls['documento'].invalid) {
      formulario.controls['nombre'].markAsTouched();
      formulario.controls['documento'].markAsTouched();
      this.avisar(documento.uuid, 'Escribe tu nombre completo y tu número de documento.');
      return;
    }
    if (aceptar && !aclaradas) {
      this.avisar(documento.uuid, 'Antes de aceptar, confirma que pudiste formular preguntas.');
      return;
    }
    if (!aceptar && String(motivo ?? '').trim().length < MINIMO_DEL_MOTIVO) {
      formulario.controls['motivo'].markAsTouched();
      this.avisar(documento.uuid, 'Indica el motivo del rechazo (mínimo 10 caracteres).');
      return;
    }
    if (this.trabajando() !== null) return;

    this.avisar(documento.uuid, '');
    this.trabajando.set(documento.uuid);
    this.service.decidir(documento.uuid, {
      aceptar,
      nombreFirmante: String(nombre).trim(),
      documentoFirmante: String(numero).trim(),
      preguntasAclaradas: !!aclaradas,
      motivoRechazo: aceptar ? null : String(motivo).trim()
    }).subscribe({
      next: () => this.terminar('Decisión registrada', 'Tu decisión quedó registrada con trazabilidad.'),
      error: err => this.fallar('No se pudo registrar la decisión', err)
    });
  }

  revocar(documento: ConsentimientoVeterinario): void {
    const formulario = this.formulario(documento.uuid);
    const motivo = formulario.controls['motivoRevocacion'];
    if (motivo.invalid || !motivo.value) {
      motivo.markAsTouched();
      this.avisar(documento.uuid, 'Indica el motivo de la revocación (mínimo 10 caracteres).');
      return;
    }
    if (this.trabajando() !== null) return;

    this.avisar(documento.uuid, '');
    this.trabajando.set(documento.uuid);
    this.service.revocarMio(documento.uuid, String(motivo.value).trim()).subscribe({
      next: () => this.terminar('Consentimiento revocado', 'El consentimiento fue revocado.'),
      error: err => this.fallar('No se pudo revocar', err)
    });
  }

  campoInvalido(uuid: string, control: string): boolean {
    const campo = this.formulario(uuid).controls[control];
    return campo.invalid && campo.touched;
  }

  etiquetaDeEstado(estado: EstadoConsentimientoVeterinario): string {
    return ESTADO_DE_CONSENTIMIENTO[estado]?.etiqueta ?? estado;
  }

  clasesDeEstado(estado: EstadoConsentimientoVeterinario): string {
    return ESTADO_DE_CONSENTIMIENTO[estado]?.clases ?? 'border-slate-200 bg-slate-50 text-slate-700';
  }

  private terminar(titulo: string, detalle: string): void {
    this.trabajando.set(null);
    this.messages.add({ severity: 'success', summary: titulo, detail: detalle });
    this.cargar();
  }

  private fallar(titulo: string, err: { error?: { message?: string } }): void {
    this.trabajando.set(null);
    this.messages.add({
      severity: 'error',
      summary: titulo,
      detail: err.error?.message ?? 'Inténtalo nuevamente.'
    });
  }

  private avisar(uuid: string, mensaje: string): void {
    this.avisos.update(actuales => ({ ...actuales, [uuid]: mensaje }));
  }

  private prepararFormularios(documentos: ConsentimientoVeterinario[]): void {
    this.formularios.clear();
    this.avisos.set({});
    for (const documento of documentos) {
      this.formularios.set(documento.uuid, this.crearFormulario());
    }
  }

  private crearFormulario(): FormGroup {
    return this.fb.nonNullable.group({
      nombre: ['', [Validators.required, Validators.maxLength(200), sinSoloEspacios]],
      documento: ['', [Validators.required, Validators.maxLength(40), sinSoloEspacios]],
      aclaradas: [false],
      motivo: ['', [Validators.maxLength(4000)]],
      motivoRevocacion: ['', [minimoSinEspacios(MINIMO_DEL_MOTIVO), Validators.maxLength(4000)]]
    });
  }
}
