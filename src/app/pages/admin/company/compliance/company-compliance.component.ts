import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { CompanyComplianceService } from '../../../../core/services/company-compliance.service';
import { CompanyService } from '../../../../core/services/company.service';
import {
  ConfiguracionCumplimiento,
  ControlCumplimiento,
  ModoGestionCumplimiento
} from '../../../../models/privacy/company-compliance.model';

const MINIMO_DE_LA_JUSTIFICACION = 10;

const NOMBRES_DE_CONTROL: Record<ControlCumplimiento, string> = {
  AVISO_PRIVACIDAD: 'Aviso de privacidad de la clínica',
  DERECHOS_DATOS: 'Derechos sobre datos personales',
  USO_IA: 'Uso de inteligencia artificial',
  RECORDATORIOS_CORREO: 'Recordatorios preventivos por correo',
  CONSENTIMIENTO_VETERINARIO: 'Consentimiento informado veterinario'
};

function minimoSinEspacios(minimo: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor = typeof control.value === 'string' ? control.value.trim() : '';
    return control.value && valor.length < minimo ? { minimo: { requerido: minimo, actual: valor.length } } : null;
  };
}

@Component({
  selector: 'app-company-compliance',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ToastModule],
  providers: [MessageService],
  templateUrl: './company-compliance.component.html'
})
export class CompanyComplianceComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(CompanyComplianceService);
  private readonly companies = inject(CompanyService);
  private readonly messages = inject(MessageService);

  readonly configuraciones = signal<ConfiguracionCumplimiento[]>([]);
  readonly empresa = signal('Clínica');
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly guardando = signal<ControlCumplimiento | null>(null);

  readonly modos: { valor: ModoGestionCumplimiento; etiqueta: string }[] = [
    { valor: 'SOFTVET', etiqueta: 'Gestionado en SoftVet' },
    { valor: 'EXTERNO', etiqueta: 'Gestionado externamente' },
    { valor: 'NO_APLICA', etiqueta: 'No aplica' }
  ];

  companyId = 0;
  private readonly formularios = new Map<ControlCumplimiento, FormGroup>();

  ngOnInit(): void {
    this.companyId = Number(this.route.snapshot.paramMap.get('id'));
    this.companies.getById(this.companyId).subscribe(respuesta => this.empresa.set(respuesta.data.name));
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.service.actuales(this.companyId).subscribe({
      next: respuesta => {
        this.configuraciones.set(respuesta.data);
        this.formularios.clear();
        for (const configuracion of respuesta.data) {
          this.formularios.set(configuracion.control, this.crearFormulario(configuracion));
        }
        this.error.set('');
        this.cargando.set(false);
      },
      error: err => {
        this.error.set(err.error?.message ?? 'No se pudo cargar la configuración.');
        this.cargando.set(false);
      }
    });
  }

  nombre(control: ControlCumplimiento): string {
    return NOMBRES_DE_CONTROL[control] ?? control;
  }

  formulario(control: ControlCumplimiento): FormGroup {
    const formulario = this.formularios.get(control);
    if (!formulario) {
      throw new Error(`No hay formulario para el control ${control}`);
    }
    return formulario;
  }

  modoNoDisponible(control: ControlCumplimiento, modo: ModoGestionCumplimiento): boolean {
    return control === 'RECORDATORIOS_CORREO' && modo === 'EXTERNO';
  }

  campoInvalido(control: ControlCumplimiento, campo: string): boolean {
    const referencia = this.formulario(control).controls[campo];
    return referencia.invalid && referencia.touched;
  }

  longitud(control: ControlCumplimiento, campo: string): number {
    return String(this.formulario(control).controls[campo].value ?? '').length;
  }

  guardar(control: ControlCumplimiento): void {
    const formulario = this.formulario(control);
    if (formulario.invalid) {
      formulario.markAllAsTouched();
      return;
    }
    if (this.guardando() !== null) return;

    const valores = formulario.getRawValue();
    this.guardando.set(control);
    this.service.configurar(this.companyId, control, {
      habilitado: valores.habilitado,
      modo: valores.modo,
      bloqueante: valores.bloqueante,
      justificacion: String(valores.justificacion).trim(),
      referenciaContractual: String(valores.referenciaContractual ?? '').trim() || null,
      confirmoRevisionLegal: valores.confirmoRevisionLegal,
      vigenteDesde: null
    }).subscribe({
      next: () => {
        this.guardando.set(null);
        this.messages.add({
          severity: 'success',
          summary: 'Nueva versión creada',
          detail: 'Quedó vigente y auditada.'
        });
        this.cargar();
      },
      error: err => {
        this.guardando.set(null);
        this.messages.add({
          severity: 'error',
          summary: 'No se pudo guardar',
          detail: err.error?.message ?? 'Revisa los datos e inténtalo nuevamente.'
        });
      }
    });
  }

  private crearFormulario(configuracion: ConfiguracionCumplimiento): FormGroup {
    const formulario = this.fb.nonNullable.group({
      habilitado: [configuracion.habilitado],
      modo: [configuracion.modo],
      bloqueante: [configuracion.bloqueante],
      justificacion: [
        configuracion.configuracionExplicita ? configuracion.justificacion : '',
        [Validators.required, minimoSinEspacios(MINIMO_DE_LA_JUSTIFICACION), Validators.maxLength(4000)]
      ],
      referenciaContractual: [configuracion.referenciaContractual ?? '', [Validators.maxLength(200)]],
      confirmoRevisionLegal: [false, [Validators.requiredTrue]]
    });

    const alinear = () => {
      const { habilitado, modo } = formulario.getRawValue();
      if (!habilitado) {
        formulario.controls.modo.setValue('NO_APLICA', { emitEvent: false });
        formulario.controls.bloqueante.setValue(false, { emitEvent: false });
        formulario.controls.modo.disable({ emitEvent: false });
        formulario.controls.bloqueante.disable({ emitEvent: false });
        return;
      }
      if (modo === 'NO_APLICA') {
        formulario.controls.modo.setValue('SOFTVET', { emitEvent: false });
      }
      formulario.controls.modo.enable({ emitEvent: false });
      if (formulario.getRawValue().modo === 'SOFTVET') {
        formulario.controls.bloqueante.enable({ emitEvent: false });
      } else {
        formulario.controls.bloqueante.disable({ emitEvent: false });
      }
    };

    alinear();
    formulario.controls.habilitado.valueChanges.subscribe(alinear);
    formulario.controls.modo.valueChanges.subscribe(() => {
      if (formulario.getRawValue().modo !== 'SOFTVET') {
        formulario.controls.bloqueante.disable({ emitEvent: false });
      } else if (formulario.getRawValue().habilitado) {
        formulario.controls.bloqueante.enable({ emitEvent: false });
      }
    });
    return formulario;
  }
}
