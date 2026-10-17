import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import {
  AYUDA_DE_DERECHO,
  ESTADO_DE_SOLICITUD,
  ETIQUETA_DE_DERECHO,
  TIPOS_DE_DERECHO
} from '../../core/constants/derechos-datos.constants';
import { DerechosDatosService } from '../../core/services/derechos-datos.service';
import { EstadoSolicitudDerecho, SolicitudDerechoDatos, TipoDerechoDatos } from '../../models/privacy/derechos-datos.model';

const MINIMO_DE_LA_DESCRIPCION = 10;
const MINIMO_DE_LA_CORRECCION = 3;
const MAXIMO_DEL_TEXTO = 4000;

function minimoSinEspacios(minimo: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor = typeof control.value === 'string' ? control.value.trim() : '';
    return control.value && valor.length < minimo ? { minimo: { requerido: minimo, actual: valor.length } } : null;
  };
}

@Component({
  selector: 'app-derechos-datos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ToastModule],
  providers: [MessageService],
  templateUrl: './derechos-datos.component.html'
})
export class DerechosDatosComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(DerechosDatosService);
  private readonly messages = inject(MessageService);

  readonly solicitudes = signal<SolicitudDerechoDatos[]>([]);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly error = signal('');

  readonly tipos = TIPOS_DE_DERECHO.map(valor => ({ valor, etiqueta: ETIQUETA_DE_DERECHO[valor] }));
  readonly maximoDelTexto = MAXIMO_DEL_TEXTO;

  readonly form = this.fb.nonNullable.group({
    tipo: this.fb.nonNullable.control<TipoDerechoDatos>('ACCESO'),
    descripcion: ['', [Validators.required, minimoSinEspacios(MINIMO_DE_LA_DESCRIPCION), Validators.maxLength(MAXIMO_DEL_TEXTO)]],
    datoRectificar: ['', [Validators.maxLength(MAXIMO_DEL_TEXTO)]]
  });

  constructor() {
    this.form.controls.tipo.valueChanges.subscribe(tipo => this.ajustarCorreccion(tipo));
  }

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.service.listarMias().subscribe({
      next: respuesta => {
        this.solicitudes.set(respuesta.data ?? []);
        this.error.set('');
        this.cargando.set(false);
      },
      error: err => {
        this.error.set(err.error?.message ?? 'No se pudieron cargar tus solicitudes.');
        this.cargando.set(false);
      }
    });
  }

  crear(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.guardando()) return;

    const { tipo, descripcion, datoRectificar } = this.form.getRawValue();
    this.guardando.set(true);
    this.service.crear(tipo, descripcion.trim(), datoRectificar.trim() || null).subscribe({
      next: () => {
        this.guardando.set(false);
        this.form.patchValue({ descripcion: '', datoRectificar: '' });
        this.form.markAsUntouched();
        this.messages.add({ severity: 'success', summary: 'Solicitud registrada', detail: 'Podrás seguir su avance más abajo.' });
        this.cargar();
      },
      error: err => {
        this.guardando.set(false);
        this.messages.add({
          severity: 'error',
          summary: 'No se pudo registrar',
          detail: err.error?.message ?? 'Revisa los datos e inténtalo nuevamente.'
        });
      }
    });
  }

  ayuda(): string {
    return AYUDA_DE_DERECHO[this.form.controls.tipo.value];
  }

  pideCorreccion(): boolean {
    return this.form.controls.tipo.value === 'RECTIFICACION';
  }

  invalido(control: 'descripcion' | 'datoRectificar'): boolean {
    const campo = this.form.controls[control];
    return campo.invalid && campo.touched;
  }

  longitud(control: 'descripcion' | 'datoRectificar'): number {
    return this.form.controls[control].value.length;
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

  private ajustarCorreccion(tipo: TipoDerechoDatos): void {
    const correccion = this.form.controls.datoRectificar;
    correccion.setValidators(
      tipo === 'RECTIFICACION'
        ? [Validators.required, minimoSinEspacios(MINIMO_DE_LA_CORRECCION), Validators.maxLength(MAXIMO_DEL_TEXTO)]
        : [Validators.maxLength(MAXIMO_DEL_TEXTO)]
    );
    correccion.updateValueAndValidity({ emitEvent: false });
  }
}
