import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ESTADO_DE_SOLICITUD, ETIQUETA_DE_DERECHO } from '../../../../core/constants/derechos-datos.constants';
import { DerechosDatosService } from '../../../../core/services/derechos-datos.service';
import {
  EstadoSolicitudDerecho,
  SolicitudDerechoDatos,
  TipoDerechoDatos
} from '../../../../models/privacy/derechos-datos.model';

export type EstadoAdministrable = Exclude<EstadoSolicitudDerecho, 'RECIBIDA'>;

type FormularioDeActuacion = FormGroup<{
  estado: FormControl<EstadoAdministrable>;
  texto: FormControl<string>;
}>;

const MINIMO_DEL_TEXTO = 10;

function minimoSinEspacios(minimo: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor = typeof control.value === 'string' ? control.value.trim() : '';
    return control.value && valor.length < minimo ? { minimo: { requerido: minimo, actual: valor.length } } : null;
  };
}

@Component({
  selector: 'app-derechos-admin',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ToastModule],
  providers: [MessageService],
  templateUrl: './derechos-admin.component.html'
})
export class DerechosAdminComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(DerechosDatosService);
  private readonly messages = inject(MessageService);

  readonly solicitudes = signal<SolicitudDerechoDatos[]>([]);
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly trabajando = signal<number | null>(null);

  readonly opcionesDeEstado: { valor: EstadoAdministrable; etiqueta: string }[] = [
    { valor: 'EN_REVISION', etiqueta: 'En revisión' },
    { valor: 'REQUIERE_INFORMACION', etiqueta: 'Requiere información' },
    { valor: 'ATENDIDA', etiqueta: 'Atendida' },
    { valor: 'RECHAZADA', etiqueta: 'Rechazada' }
  ];

  private readonly formularios = new Map<number, FormularioDeActuacion>();

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    this.service.listar().subscribe({
      next: respuesta => {
        const solicitudes = respuesta.data ?? [];
        this.solicitudes.set(solicitudes);
        this.prepararFormularios(solicitudes);
        this.cargando.set(false);
      },
      error: err => {
        this.error.set(err.error?.message ?? 'No se pudieron cargar las solicitudes.');
        this.cargando.set(false);
      }
    });
  }

  formulario(id: number): FormularioDeActuacion {
    return this.formularios.get(id) ?? this.crearFormulario('EN_REVISION');
  }

  estaAbierta(solicitud: SolicitudDerechoDatos): boolean {
    return solicitud.estado !== 'ATENDIDA' && solicitud.estado !== 'RECHAZADA';
  }

  exigeTexto(estado: EstadoAdministrable): boolean {
    return estado !== 'EN_REVISION';
  }

  maximoDelTexto(estado: EstadoAdministrable): number {
    return estado === 'RECHAZADA' ? 4000 : 8000;
  }

  etiquetaDelTexto(estado: EstadoAdministrable): string {
    return estado === 'RECHAZADA' ? 'Fundamento del rechazo' : 'Respuesta al titular';
  }

  etiquetaDeTipo(tipo: TipoDerechoDatos): string {
    return ETIQUETA_DE_DERECHO[tipo] ?? tipo;
  }

  etiquetaDeEstado(estado: EstadoSolicitudDerecho): string {
    return ESTADO_DE_SOLICITUD[estado]?.etiqueta ?? estado;
  }

  clasesDeEstado(estado: EstadoSolicitudDerecho): string {
    return ESTADO_DE_SOLICITUD[estado]?.clases ?? 'border-slate-200 bg-slate-50 text-slate-700';
  }

  textoInvalido(id: number): boolean {
    const control = this.formulario(id).controls.texto;
    return control.invalid && control.touched;
  }

  resolver(solicitud: SolicitudDerechoDatos): void {
    const formulario = this.formulario(solicitud.id);
    if (formulario.invalid) {
      formulario.markAllAsTouched();
      return;
    }
    if (this.trabajando() !== null) return;

    const { estado, texto } = formulario.getRawValue();
    const contenido = texto.trim();
    const rechazo = estado === 'RECHAZADA';

    this.trabajando.set(solicitud.id);
    this.service.actualizar(solicitud.id, estado, rechazo ? null : contenido || null, rechazo ? contenido : null).subscribe({
      next: () => {
        this.trabajando.set(null);
        this.messages.add({
          severity: 'success',
          summary: 'Actuación guardada',
          detail: `La solicitud quedó en estado «${this.etiquetaDeEstado(estado)}».`
        });
        this.cargar();
      },
      error: err => {
        this.trabajando.set(null);
        this.messages.add({
          severity: 'error',
          summary: 'No se pudo guardar',
          detail: err.error?.message ?? 'Revisa los datos e inténtalo nuevamente.'
        });
      }
    });
  }

  private prepararFormularios(solicitudes: SolicitudDerechoDatos[]): void {
    this.formularios.clear();
    for (const solicitud of solicitudes) {
      const inicial: EstadoAdministrable = solicitud.estado === 'RECIBIDA' ? 'EN_REVISION' : solicitud.estado;
      this.formularios.set(solicitud.id, this.crearFormulario(inicial));
    }
  }

  private crearFormulario(estado: EstadoAdministrable): FormularioDeActuacion {
    const formulario: FormularioDeActuacion = this.fb.nonNullable.group({
      estado: this.fb.nonNullable.control<EstadoAdministrable>(estado),
      texto: this.fb.nonNullable.control('')
    });
    const ajustar = (actual: EstadoAdministrable) => {
      const texto = formulario.controls.texto;
      texto.setValidators(
        this.exigeTexto(actual)
          ? [Validators.required, minimoSinEspacios(MINIMO_DEL_TEXTO), Validators.maxLength(this.maximoDelTexto(actual))]
          : [Validators.maxLength(this.maximoDelTexto(actual))]
      );
      texto.updateValueAndValidity({ emitEvent: false });
    };
    ajustar(estado);
    formulario.controls.estado.valueChanges.subscribe(ajustar);
    return formulario;
  }
}
