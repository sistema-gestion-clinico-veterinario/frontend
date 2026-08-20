import { Component, OnDestroy, OnInit, inject, signal, computed } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { AbstractControl, ReactiveFormsModule, FormBuilder, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TimelineModule } from 'primeng/timeline';
import { CardModule } from 'primeng/card';
import { MessageService, ConfirmationService } from 'primeng/api';
import { DrawerModule } from 'primeng/drawer';
import { BadgeModule } from 'primeng/badge';
import { EMPTY, Observable, Subscription, catchError, concatMap, debounceTime, filter, finalize, map, of, switchMap, tap } from 'rxjs';

import { HistoriaClinicaService } from '../../../core/services/historia-clinica.service';
import { LoadingStore } from '../../../store/loading.store';
import { AuthStore } from '../../../store/auth.store';
import { ConsultaResponse } from '../../../models/response/consulta-response';
import { PrescripcionResponse } from '../../../models/response/prescripcion-response';
import { PrescripcionRequest } from '../../../models/request/prescripcion-request';
import { ArchivoClinicoResponse } from '../../../models/response/archivo-clinico-response';
import { RecetaModalsComponent } from '../form-hc/receta-modals/receta-modals.component';
import { ArchivoModalsComponent } from '../form-hc/archivo-modals/archivo-modals.component';
import { Role } from '../../../core/enums/role.enum';
import { noLeadingTrailingSpaceValidator } from '../../../core/validators/no-leading-trailing-space.validator';
import { textContentValidator } from '../../../core/validators/text-content.validator';
import { normalizeText } from '../../../core/utils/normalize-text.util';
import { hasMeaningfulText } from '../../../core/utils/input-validation.util';
import { ControlPreventivoService } from '../../../core/services/control-preventivo.service';
import { AplicacionPreventivaResponse, ControlPreventivoResponse, TipoControlPreventivo, TipoVacunaResponse } from '../../../models/response/control-preventivo-response';


@Component({
  selector: 'app-consulta-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ToastModule,
    ButtonModule,
    ConfirmDialogModule,
    TimelineModule,
    CardModule,
    DrawerModule,
    BadgeModule,
    RecetaModalsComponent,
    ArchivoModalsComponent
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './consulta-form.component.html'
})
export class ConsultaFormComponent implements OnInit, OnDestroy {
  private readonly route       = inject(ActivatedRoute);
  private readonly router      = inject(Router);
  private readonly fb          = inject(FormBuilder);
  private readonly hcService   = inject(HistoriaClinicaService);
  private readonly preventivoService = inject(ControlPreventivoService);
  private readonly msgService  = inject(MessageService);
  private readonly confirmSvc  = inject(ConfirmationService);
  private readonly sanitizer   = inject(DomSanitizer);
  readonly loadingStore        = inject(LoadingStore);
  readonly authStore          = inject(AuthStore);
  returnUrl = '/citas/agenda';

  readonly canCreate = computed(() => this.authStore.hasAccess('VISTA_HISTORIAS', 'escribir'));
  readonly canModify = computed(() => this.authStore.hasAccess('VISTA_HISTORIAS', 'modificar'));
  readonly canDelete = computed(() => this.authStore.hasAccess('VISTA_HISTORIAS', 'eliminar'));
  readonly isAdminOrSuper = computed(() => this.authStore.roles().includes(Role.ADMIN) || this.authStore.roles().includes(Role.SUPER_ADMIN));
  readonly accessMode = signal<'auto' | 'view' | 'edit'>('auto');
  readonly canEditConsulta = computed(() =>
    this.canModify()
    && this.accessMode() !== 'view'
    && (!this.isCerrada() || this.accessMode() === 'edit')
  );
  readonly canCreateReceta = computed(() => this.canCreate() && this.canEditConsulta() && (!this.isCerrada() || this.isAdminOrSuper()));
  readonly canModifyReceta = computed(() => this.canEditConsulta() && (!this.isCerrada() || this.isAdminOrSuper()));
  readonly canDeleteReceta = computed(() => this.canDelete() && this.canEditConsulta() && (!this.isCerrada() || this.isAdminOrSuper()));
  readonly canCreateArchivo = computed(() => this.canCreate() && this.canEditConsulta() && (!this.isCerrada() || this.isAdminOrSuper()));
  readonly canDeleteArchivo = computed(() => this.canDelete() && this.canEditConsulta() && (!this.isCerrada() || this.isAdminOrSuper()));

  consulta   = signal<ConsultaResponse | null>(null);
  historia   = signal<any | null>(null); 
  tabActiva  = signal<'signos' | 'clinico' | 'antecedentes' | 'historial' | 'recetas' | 'examenes'>('signos');
  isCerrada  = signal<boolean>(false);
  autoSaveStatus = signal<'idle' | 'saving' | 'saved' | 'error' | 'invalid'>('idle');
  consultaId = 0;
  displayDetalleHistorial = signal<boolean>(false);
  detalleSeleccionado      = signal<any | null>(null);
  controlesPreventivos = signal<ControlPreventivoResponse[]>([]);
  aplicacionesPreventivas = signal<AplicacionPreventivaResponse[]>([]);
  tiposVacuna = signal<TipoVacunaResponse[]>([]);
  guardandoPreventivo = signal(false);
  nuevoTipoVacuna = signal('');
  nuevaVacunaPeriodicidad = signal(12);
  mostrarCreacionVacuna = signal(false);
  accionPreventiva = signal<'APLICACION' | 'PROGRAMACION' | null>(null);
  tipoPreventivoActivo = signal<TipoControlPreventivo>('VACUNACION');
  editarProximaVacuna = signal(false);
  editarProximaDesparasitacion = signal(false);
  controlReprogramandoId = signal<number | null>(null);
  fechaReprogramacion = signal('');
  paginaControles = signal(0);
  paginaAplicaciones = signal(0);
  readonly elementosPreventivosPorPagina = 4;

  readonly controlesAbiertos = computed(() => this.controlesPreventivos()
    .filter(c => !['APLICADO', 'CANCELADO'].includes(c.estado))
    .sort((a, b) => a.fechaRecomendada.localeCompare(b.fechaRecomendada)));
  readonly totalPaginasControles = computed(() =>
    Math.ceil(this.controlesAbiertos().length / this.elementosPreventivosPorPagina));
  readonly controlesAbiertosPaginados = computed(() => {
    const inicio = this.paginaControles() * this.elementosPreventivosPorPagina;
    return this.controlesAbiertos().slice(inicio, inicio + this.elementosPreventivosPorPagina);
  });
  readonly aplicacionesOrdenadas = computed(() => [...this.aplicacionesPreventivas()]
    .sort((a, b) => b.fechaAplicacion.localeCompare(a.fechaAplicacion)));
  readonly totalPaginasAplicaciones = computed(() =>
    Math.ceil(this.aplicacionesOrdenadas().length / this.elementosPreventivosPorPagina));
  readonly aplicacionesPaginadas = computed(() => {
    const inicio = this.paginaAplicaciones() * this.elementosPreventivosPorPagina;
    return this.aplicacionesOrdenadas().slice(inicio, inicio + this.elementosPreventivosPorPagina);
  });
  readonly controlesVacunacionAbiertos = computed(() => this.controlesAbiertos().filter(c => c.tipo === 'VACUNACION'));
  readonly controlesDesparasitacionAbiertos = computed(() => this.controlesAbiertos().filter(c => c.tipo === 'DESPARASITACION'));
  readonly tieneVacunacionRegistrada = computed(() => this.controlesPreventivos().some(c => c.tipo === 'VACUNACION')
    || this.aplicacionesPreventivas().some(a => a.tipo === 'VACUNACION'));
  readonly tieneDesparasitacionRegistrada = computed(() => this.controlesPreventivos().some(c => c.tipo === 'DESPARASITACION')
    || this.aplicacionesPreventivas().some(a => a.tipo === 'DESPARASITACION'));
  readonly vacunacionAlDiaCalculada = computed(() => this.tieneVacunacionRegistrada() && !this.controlesAbiertos().some(c =>
    c.tipo === 'VACUNACION' && ['PENDIENTE', 'ATRASADO'].includes(c.estado)));
  readonly desparasitacionAlDiaCalculada = computed(() => this.tieneDesparasitacionRegistrada() && !this.controlesAbiertos().some(c =>
    c.tipo === 'DESPARASITACION' && ['PENDIENTE', 'ATRASADO'].includes(c.estado)));

  archivos           = signal<ArchivoClinicoResponse[]>([]);
  archivoSubiendo    = signal<boolean>(false);
  archivoPendiente   = signal<File | null>(null);
  tipoSeleccionado   = signal<string>('LABORATORIO');
  descripcionArchivo = signal<string>('');
  archivoEliminando  = signal<ArchivoClinicoResponse | null>(null);
  showConfirmEliminarArchivo = signal<boolean>(false);
  previewArchivo     = signal<ArchivoClinicoResponse | null>(null);
  previewUrl         = signal<SafeResourceUrl | string>('');
  previewRawUrl      = signal<string>('');
  previewTipo        = signal<'imagen' | 'pdf' | 'dcm' | null>(null);

  readonly tiposArchivo = [
    { label: 'Laboratorio',  value: 'LABORATORIO' },
    { label: 'Radiografía',  value: 'RADIOGRAFIA' },
    { label: 'Ecografía',    value: 'ECOGRAFIA'   },
    { label: 'Imagen',       value: 'IMAGEN'      },
    { label: 'Otro',         value: 'OTRO'        },
  ];

  recetas            = signal<PrescripcionResponse[]>([]);
  showRecetaModal    = signal<boolean>(false);
  recetaEditando     = signal<PrescripcionResponse | null>(null);
  recetaEliminando   = signal<PrescripcionResponse | null>(null);
  showConfirmEliminar = signal<boolean>(false);
  private autosaveSub?: Subscription;
  private syncingForm = false;

  recetaForm: FormGroup = this.fb.group({
    medicamento:       ['', [Validators.required, Validators.maxLength(80), Validators.pattern(/^[\p{L}\s.,;:()\/\-+°%]*$/u), noLeadingTrailingSpaceValidator(), textContentValidator()]],
    principioActivo:   ['', [Validators.maxLength(80), Validators.pattern(/^[\p{L}\s.,;:()\/\-+°%]*$/u), noLeadingTrailingSpaceValidator(), textContentValidator()]],
    dosis:             ['', [Validators.required, Validators.maxLength(80), noLeadingTrailingSpaceValidator(), textContentValidator()]],
    frecuencia:        ['', [Validators.required, Validators.maxLength(80), noLeadingTrailingSpaceValidator(), textContentValidator()]],
    duracionDias:      [null, [this.finiteNumberValidator(), this.integerNumberValidator(), Validators.min(1), Validators.max(365)]],
    viaAdministracion: ['', [Validators.required, Validators.maxLength(50), noLeadingTrailingSpaceValidator(), textContentValidator()]],
    instrucciones:     ['', [Validators.maxLength(500), noLeadingTrailingSpaceValidator(), textContentValidator()]],
    fechaInicio:       ['', Validators.required],
    fechaFin:          [''],
  });

  readonly tiposConsulta = [
    { label: 'Primera vez',      value: 'PRIMERA_VEZ'      },
    { label: 'Seguimiento',      value: 'SEGUIMIENTO'      },
    { label: 'Control rutina',   value: 'CONTROL_RUTINA'   },
    { label: 'Emergencia',       value: 'EMERGENCIA'       },
    { label: 'Cirugía',          value: 'CIRUGIA'          },
    { label: 'Vacunación',       value: 'VACUNACION'       },
    { label: 'Desparasitación',  value: 'DESPARASITACION'   },
    { label: 'Otro',             value: 'OTRO'             },
  ];

  form: FormGroup = this.fb.group({
    version:                 [null, Validators.required],
    tipoConsulta:            [null, Validators.required],
    motivoConsulta:          [{ value: '', disabled: true }],
    pesoEnConsulta:          [null, [Validators.required, this.finiteNumberValidator(), Validators.min(0.01), Validators.max(120)]],
    temperatura:             [null, [this.finiteNumberValidator(), Validators.min(0.1), Validators.max(45)]],
    frecuenciaCardiaca:      [null, [this.finiteNumberValidator(), this.integerNumberValidator(), Validators.min(1), Validators.max(300)]],
    frecuenciaRespiratoria:  [null, [this.finiteNumberValidator(), this.integerNumberValidator(), Validators.min(1), Validators.max(200)]],
    mucosas:                 ['', [Validators.maxLength(80), Validators.pattern(/^[\p{L}\s.,;:()\/\-+°%]*$/u), noLeadingTrailingSpaceValidator(), textContentValidator()]],
    turgenciaPiel:           ['', [Validators.maxLength(80), Validators.pattern(/^[\p{L}\s.,;:()\/\-+°%]*$/u), noLeadingTrailingSpaceValidator(), textContentValidator()]],
    vacunacionAplicada:        [false],
    observacionVacunacion:     ['', [Validators.maxLength(500), noLeadingTrailingSpaceValidator(), textContentValidator()]],
    desparasitacionAplicada:   [false],
    observacionDesparasitacion:['', [Validators.maxLength(500), noLeadingTrailingSpaceValidator(), textContentValidator()]],
    anamnesis:               ['',   [Validators.required, Validators.maxLength(1000), noLeadingTrailingSpaceValidator(), textContentValidator()]],
    examenFisico:            ['', [Validators.maxLength(1000), noLeadingTrailingSpaceValidator(), textContentValidator()]],
    observaciones:           ['', [Validators.maxLength(500), noLeadingTrailingSpaceValidator(), textContentValidator()]],
    antecedentesEnfermedades:    ['', [Validators.maxLength(500), noLeadingTrailingSpaceValidator(), textContentValidator()]],
    antecedentesProcedimientos:  ['', [Validators.maxLength(500), noLeadingTrailingSpaceValidator(), textContentValidator()]],
    antecedentesPersonales:      ['', [Validators.maxLength(500), noLeadingTrailingSpaceValidator(), textContentValidator()]],
    antecedentesFamiliares:      ['', [Validators.maxLength(500), noLeadingTrailingSpaceValidator(), textContentValidator()]],
    grupoSanguineo:              ['', [Validators.maxLength(20), noLeadingTrailingSpaceValidator(), textContentValidator({ requireLetter: false })]],
    indicacionesReceta:          ['', [Validators.maxLength(500), noLeadingTrailingSpaceValidator(), textContentValidator()]],
  });

  vacunacionForm = this.fb.group({
    controlPreventivoId: [null as number | null],
    tipoVacunaId: [null as number | null, Validators.required],
    fechaAplicacion: [this.fechaHoy(), Validators.required],
    periodicidadMeses: [12, [Validators.required, Validators.min(1), Validators.max(120)]],
    fechaProximaDosis: [''],
  });

  desparasitacionForm = this.fb.group({
    controlPreventivoId: [null as number | null],
    producto: ['', [Validators.required, Validators.maxLength(100)]],
    fechaAplicacion: [this.fechaHoy(), Validators.required],
    periodicidadMeses: [3, [Validators.required, Validators.min(1), Validators.max(120)]],
    fechaProximaAplicacion: [''],
  });

  pendienteForm = this.fb.group({
    tipo: ['VACUNACION' as TipoControlPreventivo, Validators.required],
    tipoVacunaId: [null as number | null],
    nombreControl: [''],
    fechaRecomendada: [this.fechaHoy(), Validators.required],
  });

  ngOnInit() {
    this.setupAutosave();
    this.route.queryParamMap.subscribe(params => {
      if (params.get('returnUrl')) {
        this.returnUrl = params.get('returnUrl')!;
      }
      const mode = params.get('mode');
      this.accessMode.set(mode === 'view' || mode === 'edit' ? mode : 'auto');
      if (this.consulta()) {
        this.aplicarEstadoEdicionFormulario();
      }
      if (params.get('tab') === 'recetas') {
        this.tabActiva.set('recetas');
      }
    });
    this.route.params.subscribe(params => {
      this.consultaId = Number(params['consultaId']);
      if (!this.consultaId) {
        this.msgService.add({ severity: 'error', summary: 'Error', detail: 'ID de consulta no válido' });
        this.router.navigateByUrl(this.returnUrl);
        return;
      }
      this.loadConsulta();
    });
  }

  ngOnDestroy() {
    this.autosaveSub?.unsubscribe();
  }

  blockInvalidNumberInput(event: KeyboardEvent, allowDecimal = false) {
    const blocked = ['e', 'E', '+', '-'];
    if (blocked.includes(event.key)) {
      event.preventDefault();
      return;
    }

    if (!allowDecimal && ['.', ','].includes(event.key)) {
      event.preventDefault();
    }
  }

  blockInvalidNumberPaste(event: ClipboardEvent, allowDecimal = false) {
    const text = event.clipboardData?.getData('text')?.trim() ?? '';
    const pattern = allowDecimal ? /^\d{1,3}(\.\d{1,2})?$/ : /^\d{1,3}$/;
    if (!pattern.test(text)) {
      event.preventDefault();
    }
  }

  sanitizeNumberField(controlName: string, maxIntegerDigits: number, maxDecimalDigits = 0) {
    const control = this.form.get(controlName);
    const rawValue = control?.value;
    if (rawValue === null || rawValue === undefined || rawValue === '') return;

    const value = String(rawValue).replace(',', '.');
    const cleaned = this.cleanNumericText(value, maxIntegerDigits, maxDecimalDigits);
    if (cleaned !== value) {
      control?.setValue(cleaned === '' ? null : Number(cleaned), { emitEvent: false });
    }
  }

  private cleanNumericText(value: string, maxIntegerDigits: number, maxDecimalDigits: number): string {
    const numeric = value.replace(/[^\d.]/g, '');
    const [integerPart = '', ...decimalParts] = numeric.split('.');
    const integer = integerPart.slice(0, maxIntegerDigits);
    if (maxDecimalDigits <= 0 || decimalParts.length === 0) return integer;
    const decimal = decimalParts.join('').slice(0, maxDecimalDigits);
    return decimal.length > 0 ? `${integer}.${decimal}` : integer;
  }

  blockInvalidClinicalTextInput(event: KeyboardEvent) {
    if (event.key.length > 1) return;
    if (!this.isAllowedClinicalText(event.key)) {
      event.preventDefault();
    }
  }

  blockInvalidClinicalTextPaste(event: ClipboardEvent) {
    const text = event.clipboardData?.getData('text') ?? '';
    if (this.cleanClinicalText(text) !== text) {
      event.preventDefault();
    }
  }

  blockInvalidDescriptorTextInput(event: KeyboardEvent) {
    if (event.key.length > 1) return;
    if (!this.isAllowedClinicalText(event.key, false)) {
      event.preventDefault();
    }
  }

  blockInvalidDescriptorTextPaste(event: ClipboardEvent) {
    const text = event.clipboardData?.getData('text') ?? '';
    if (this.cleanClinicalText(text, false) !== text) {
      event.preventDefault();
    }
  }

  sanitizeClinicalText(controlName: string) {
    const control = this.form.get(controlName);
    const value = control?.value;
    if (typeof value !== 'string') return;
    const cleaned = this.cleanClinicalText(value);
    if (cleaned !== value) {
      control?.setValue(cleaned, { emitEvent: false });
    }
  }

  sanitizeDescriptorText(controlName: string) {
    const control = this.form.get(controlName);
    const value = control?.value;
    if (typeof value !== 'string') return;
    const cleaned = this.cleanClinicalText(value, false);
    if (cleaned !== value) {
      control?.setValue(cleaned, { emitEvent: false });
    }
  }

  private cleanClinicalText(value: string, allowNumbers = true): string {
    return Array.from(value).filter((char) => this.isAllowedClinicalText(char, allowNumbers)).join('');
  }

  private isAllowedClinicalText(char: string, allowNumbers = true): boolean {
    const pattern = allowNumbers ? /^[\p{L}\p{N}\s.,;:()\/\-+°%]$/u : /^[\p{L}\s.,;:()\/\-+°%]$/u;
    return pattern.test(char);
  }

  controlError(controlName: string, requiredMessage?: string): string {
    const control = this.form.get(controlName);
    if (!control?.errors) return '';

    if (control.errors['required']) return requiredMessage ?? 'Campo requerido.';
    if (control.errors['minlength']) return `Mínimo ${control.errors['minlength'].requiredLength} caracteres.`;
    if (control.errors['maxlength']) return `Máximo ${control.errors['maxlength'].requiredLength} caracteres.`;
    if (control.errors['finiteNumber']) return 'Ingrese un número válido.';
    if (control.errors['integerNumber']) return 'Ingrese un número entero.';
    if (control.errors['pattern']) return 'Use solo letras y puntuación clínica básica; no ingrese números ni símbolos especiales.';
    if (control.errors['textContent'] || control.errors['leadingTrailingSpace']) {
      return 'Ingrese texto real, sin espacios al inicio/final ni solo números, puntos o símbolos.';
    }
    if (control.errors['min']) return `Valor mínimo: ${control.errors['min'].min}.`;
    if (control.errors['max']) return `Valor máximo: ${control.errors['max'].max}.`;

    return 'Valor inválido.';
  }

  private finiteNumberValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (control.value === null || control.value === undefined || control.value === '') return null;
      const value = Number(control.value);
      return Number.isFinite(value) ? null : { finiteNumber: true };
    };
  }

  private integerNumberValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (control.value === null || control.value === undefined || control.value === '') return null;
      const value = Number(control.value);
      return Number.isInteger(value) ? null : { integerNumber: true };
    };
  }

  loadConsulta() {
    this.loadingStore.show();
    this.hcService.getConsulta(this.consultaId).subscribe({
      next: (res) => {
        this.consulta.set(res.data);
        this.isCerrada.set(res.data.estado === 'CERRADA');
        if (res.data.mascotaId) {
          this.loadHistoria(res.data.mascotaId);
          this.loadPreventivos(res.data.mascotaId);
        }
        this.loadRecetas();
        this.loadArchivos();

        this.syncingForm = true;
        this.form.patchValue({
          tipoConsulta:            res.data.tipoConsulta           ?? null,
          motivoConsulta:          res.data.motivoConsulta         ?? '',
          pesoEnConsulta:          res.data.pesoEnConsulta         ?? null,
          temperatura:             res.data.temperatura            ?? null,
          frecuenciaCardiaca:      res.data.frecuenciaCardiaca     ?? null,
          frecuenciaRespiratoria:  res.data.frecuenciaRespiratoria ?? null,
          mucosas:                 res.data.mucosas                ?? '',
          turgenciaPiel:           res.data.turgenciaPiel          ?? '',
          vacunacionAplicada:         res.data.vacunacionAplicada        ?? false,
          observacionVacunacion:      res.data.observacionVacunacion     ?? '',
          desparasitacionAplicada:    res.data.desparasitacionAplicada   ?? false,
          observacionDesparasitacion: res.data.observacionDesparasitacion ?? '',
          anamnesis:               res.data.anamnesis              ?? '',
          examenFisico:            res.data.examenFisico           ?? '',
          observaciones:           res.data.observaciones          ?? '',
          antecedentesEnfermedades:    res.data.antecedentesEnfermedades    ?? '',
          antecedentesProcedimientos:  res.data.antecedentesProcedimientos  ?? '',
          antecedentesPersonales:      res.data.antecedentesPersonales      ?? '',
          antecedentesFamiliares:      res.data.antecedentesFamiliares      ?? '',
          grupoSanguineo:              res.data.grupoSanguineo              ?? '',
          indicacionesReceta:          res.data.indicacionesReceta          ?? '',
          version:                     res.data.version,
        }, { emitEvent: false });
        this.aplicarEstadoEdicionFormulario();
        this.form.markAsPristine();
        this.autoSaveStatus.set('saved');
        this.syncingForm = false;
        this.loadingStore.hide();
      },
      error: () => {
        this.msgService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar la consulta' });
        this.loadingStore.hide();
      }
    });
  }

  loadHistoria(mascotaId: number) {
    this.hcService.getPorMascota(mascotaId).subscribe({
      next: (res) => this.historia.set(res.data)
    });
  }

  // Recorta espacios al inicio/final de los campos de texto antes de persistir.
  // No se usa un validador que rechace al escribir porque el autosave (debounce 1200ms)
  // se dispararía como "inválido" cada vez que el usuario hace una pausa justo después
  // de un espacio mientras redacta texto clínico largo (anamnesis, examen físico, etc.).
  private trimStringFields<T extends Record<string, any>>(value: T): T {
    const trimmed: Record<string, any> = { ...value };
    for (const key of Object.keys(trimmed)) {
      if (typeof trimmed[key] === 'string') {
        // Normalizar: colapsar espacios internos múltiples y eliminar extremos
        trimmed[key] = trimmed[key].replace(/\s+/g, ' ').trim();
      }
    }
    return trimmed as T;
  }

  loadPreventivos(mascotaId: number) {
    this.preventivoService.listarControles(mascotaId).subscribe({
      next: res => {
this.paginaControles.set(0);
        this.controlesPreventivos.set(res.data ?? []);
      },
      error: () => this.msgService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los controles preventivos' })
    });
    this.preventivoService.listarAplicaciones(mascotaId).subscribe({
      next: res => {
        this.paginaAplicaciones.set(0);
        this.aplicacionesPreventivas.set(res.data ?? []);
      }
    });
    this.preventivoService.listarTiposVacuna(mascotaId).subscribe({
      next: res => this.tiposVacuna.set(res.data ?? [])
    });
  }

  crearTipoVacuna() {
    const nombre = this.nuevoTipoVacuna().trim();
    const especie = this.consulta()?.especie;
    const periodicidad = Number(this.nuevaVacunaPeriodicidad());
    if (!nombre || !especie || !Number.isInteger(periodicidad) || periodicidad < 1 || periodicidad > 120) {
      this.msgService.add({ severity: 'warn', summary: 'Datos incompletos', detail: 'Indique un nombre y una periodicidad entre 1 y 120 meses' });
      return;
    }
    this.guardandoPreventivo.set(true);
    this.preventivoService.crearTipoVacuna({ nombre, especie, periodicidadMesesSugerida: periodicidad }).pipe(
      finalize(() => this.guardandoPreventivo.set(false))
    ).subscribe({
      next: res => {
        this.tiposVacuna.update(items => [...items, res.data].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        this.vacunacionForm.patchValue({ tipoVacunaId: res.data.id, periodicidadMeses: res.data.periodicidadMesesSugerida ?? 12 });
        this.nuevoTipoVacuna.set('');
        this.nuevaVacunaPeriodicidad.set(12);
        this.mostrarCreacionVacuna.set(false);
        this.msgService.add({ severity: 'success', summary: 'Vacuna creada', detail: 'Ya puede registrar su aplicación' });
      },
      error: err => this.msgService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo crear la vacuna' })
    });
  }

  seleccionarTipoVacuna(value: string) {
    const id = Number(value);
    const tipo = this.tiposVacuna().find(v => v.id === id);
    const controles = this.controlesVacunacionAbiertos()
      .filter(c => c.tipoVacunaId === id)
      .sort((a, b) => a.fechaRecomendada.localeCompare(b.fechaRecomendada));
    this.vacunacionForm.patchValue({
      tipoVacunaId: id,
      periodicidadMeses: tipo?.periodicidadMesesSugerida ?? 12,
      controlPreventivoId: controles[0]?.id ?? null,
      fechaProximaDosis: ''
    });
    this.editarProximaVacuna.set(false);
  }

  cambiarPaginaControles(direccion: -1 | 1) {
    const ultimaPagina = Math.max(0, this.totalPaginasControles() - 1);
    this.paginaControles.update(actual => Math.min(ultimaPagina, Math.max(0, actual + direccion)));
    this.controlReprogramandoId.set(null);
  }

  cambiarPaginaAplicaciones(direccion: -1 | 1) {
    const ultimaPagina = Math.max(0, this.totalPaginasAplicaciones() - 1);
    this.paginaAplicaciones.update(actual => Math.min(ultimaPagina, Math.max(0, actual + direccion)));
  }

  controlesCoincidentesVacuna() {
    const id = this.vacunacionForm.value.tipoVacunaId;
    return this.controlesVacunacionAbiertos()
      .filter(c => c.tipoVacunaId === id)
      .sort((a, b) => a.fechaRecomendada.localeCompare(b.fechaRecomendada));
  }

  seleccionarControlVacunacion(value: string) {
    const id = Number(value);
    const control = this.controlesVacunacionAbiertos().find(c => c.id === id);
    const vacuna = this.tiposVacuna().find(v => v.id === control?.tipoVacunaId);
    this.vacunacionForm.patchValue({
      controlPreventivoId: control?.id ?? null,
      tipoVacunaId: control?.tipoVacunaId ?? this.vacunacionForm.value.tipoVacunaId,
      periodicidadMeses: vacuna?.periodicidadMesesSugerida ?? this.vacunacionForm.value.periodicidadMeses
    });
  }

  seleccionarControlDesparasitacion(value: string) {
    const id = Number(value);
    const control = this.controlesDesparasitacionAbiertos().find(c => c.id === id);
    this.desparasitacionForm.patchValue({
      controlPreventivoId: control?.id ?? null,
      producto: control?.nombreControl ?? this.desparasitacionForm.value.producto
    });
  }

  registrarVacunacion() {
    if (this.vacunacionForm.invalid || !this.consulta()?.mascotaId) {
      this.vacunacionForm.markAllAsTouched();
      return;
    }
    const value = this.vacunacionForm.getRawValue();
    const proxima = value.fechaProximaDosis
      || this.sumarMeses(value.fechaAplicacion!, Number(value.periodicidadMeses));
    this.guardandoPreventivo.set(true);
    this.preventivoService.registrarVacunacion(this.consultaId, {
      controlPreventivoId: value.controlPreventivoId ?? undefined,
      tipoVacunaId: value.tipoVacunaId!,
      fechaAplicacion: value.fechaAplicacion!,
      periodicidadMeses: Number(value.periodicidadMeses),
      fechaProximaDosis: proxima,
    }).pipe(finalize(() => this.guardandoPreventivo.set(false))).subscribe({
      next: () => this.preventivoGuardado('Vacunación registrada', true),
      error: err => this.msgService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo registrar la vacunación' })
    });
  }

  registrarDesparasitacion() {
    if (this.desparasitacionForm.invalid || !this.consulta()?.mascotaId) {
      this.desparasitacionForm.markAllAsTouched();
      return;
    }
    const value = this.desparasitacionForm.getRawValue();
    const proxima = value.fechaProximaAplicacion
      || this.sumarMeses(value.fechaAplicacion!, Number(value.periodicidadMeses));
    this.guardandoPreventivo.set(true);
    this.preventivoService.registrarDesparasitacion(this.consultaId, {
      controlPreventivoId: value.controlPreventivoId ?? undefined,
      producto: value.producto!.trim(),
      fechaAplicacion: value.fechaAplicacion!,
      periodicidadMeses: Number(value.periodicidadMeses),
      fechaProximaAplicacion: proxima,
    }).pipe(finalize(() => this.guardandoPreventivo.set(false))).subscribe({
      next: () => this.preventivoGuardado('Desparasitación registrada', true),
      error: err => this.msgService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo registrar la desparasitación' })
    });
  }

  programarPendiente() {
    const mascotaId = this.consulta()?.mascotaId;
    if (!mascotaId || this.pendienteForm.invalid) return;
    const value = this.pendienteForm.getRawValue();
    if (value.tipo === 'VACUNACION' && !value.tipoVacunaId) {
      this.msgService.add({ severity: 'warn', summary: 'Vacuna requerida', detail: 'Seleccione la vacuna pendiente' });
      return;
    }
    if (value.tipo === 'DESPARASITACION' && !value.nombreControl?.trim()) {
      this.msgService.add({ severity: 'warn', summary: 'Producto requerido', detail: 'Indique el control de desparasitación' });
      return;
    }
    this.guardandoPreventivo.set(true);
    this.preventivoService.programar(mascotaId, {
      tipo: value.tipo!,
      tipoVacunaId: value.tipo === 'VACUNACION' ? value.tipoVacunaId! : undefined,
      nombreControl: value.tipo === 'DESPARASITACION' ? value.nombreControl!.trim() : undefined,
      fechaRecomendada: value.fechaRecomendada!,
    }).pipe(finalize(() => this.guardandoPreventivo.set(false))).subscribe({
      next: () => this.preventivoGuardado('Control pendiente programado'),
      error: err => this.msgService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo programar el control' })
    });
  }

  claseEstadoPreventivo(estado: string) {
    if (estado === 'ATRASADO') return 'bg-rose-50 text-rose-700';
    if (estado === 'PENDIENTE' || estado === 'PROXIMO') return 'bg-amber-50 text-amber-700';
    if (estado === 'SUSPENDIDO_POR_CITA') return 'bg-sky-50 text-sky-700';
    return 'bg-emerald-50 text-emerald-700';
  }

  etiquetaEstadoPreventivo(control: ControlPreventivoResponse) {
    const etiquetas: Record<string, string> = {
      PROGRAMADO: 'Programado',
      PROXIMO: 'Vence próximamente',
      PENDIENTE: 'Debe aplicarse hoy',
      ATRASADO: 'Control vencido',
      SUSPENDIDO_POR_CITA: 'Cita programada',
      APLICADO: 'Aplicado',
      CANCELADO: 'Cancelado'
    };
    return etiquetas[control.estado] ?? control.estado;
  }

  prepararAplicacion(control: ControlPreventivoResponse) {
    this.accionPreventiva.set('APLICACION');
    this.tipoPreventivoActivo.set(control.tipo);
    if (control.tipo === 'VACUNACION') {
      this.seleccionarControlVacunacion(String(control.id));
    } else {
      this.seleccionarControlDesparasitacion(String(control.id));
    }
  }

  iniciarReprogramacion(control: ControlPreventivoResponse) {
    this.controlReprogramandoId.set(control.id);
    this.fechaReprogramacion.set(control.fechaRecomendada);
  }

  guardarReprogramacion(control: ControlPreventivoResponse) {
    const fecha = this.fechaReprogramacion();
    if (!fecha) return;
    this.guardandoPreventivo.set(true);
    this.preventivoService.reprogramar(control.id, fecha).pipe(
      finalize(() => this.guardandoPreventivo.set(false))
    ).subscribe({
      next: () => {
        this.controlReprogramandoId.set(null);
        this.preventivoGuardado('Control reprogramado');
      },
      error: err => this.msgService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo reprogramar el control' })
    });
  }

  confirmarCancelarControl(control: ControlPreventivoResponse) {
    this.confirmSvc.confirm({
      header: 'Cancelar control',
      message: `¿Desea cancelar el control "${control.nombreControl}"?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Cancelar control',
      rejectLabel: 'Volver',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.guardandoPreventivo.set(true);
        this.preventivoService.cancelar(control.id).pipe(
          finalize(() => this.guardandoPreventivo.set(false))
        ).subscribe({
          next: () => this.preventivoGuardado('Control cancelado'),
          error: err => this.msgService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo cancelar el control' })
        });
      }
    });
  }

  proximaVacunaSugerida() {
    const value = this.vacunacionForm.getRawValue();
    return value.fechaAplicacion && value.periodicidadMeses
      ? this.sumarMeses(value.fechaAplicacion, Number(value.periodicidadMeses)) : '';
  }

  proximaDesparasitacionSugerida() {
    const value = this.desparasitacionForm.getRawValue();
    return value.fechaAplicacion && value.periodicidadMeses
      ? this.sumarMeses(value.fechaAplicacion, Number(value.periodicidadMeses)) : '';
  }

  alternarEdicionProximaVacuna() {
    if (this.editarProximaVacuna()) {
      this.vacunacionForm.patchValue({ fechaProximaDosis: '' });
    }
    this.editarProximaVacuna.update(valor => !valor);
  }

  alternarEdicionProximaDesparasitacion() {
    if (this.editarProximaDesparasitacion()) {
      this.desparasitacionForm.patchValue({ fechaProximaAplicacion: '' });
    }
    this.editarProximaDesparasitacion.update(valor => !valor);
  }

  fechaHoyPublica() {
    return this.fechaHoy();
  }

  private sumarMeses(fecha: string, meses: number): string {
    const [anio, mes, dia] = fecha.split('-').map(Number);
    const primerDiaDestino = new Date(anio, mes - 1 + meses, 1);
    const ultimoDiaDestino = new Date(
      primerDiaDestino.getFullYear(),
      primerDiaDestino.getMonth() + 1,
      0
    ).getDate();
    const resultado = new Date(
      primerDiaDestino.getFullYear(),
      primerDiaDestino.getMonth(),
      Math.min(dia, ultimoDiaDestino)
    );
    return `${resultado.getFullYear()}-${String(resultado.getMonth() + 1).padStart(2, '0')}-${String(resultado.getDate()).padStart(2, '0')}`;
  }

  private preventivoGuardado(mensaje: string, actualizaVersionConsulta = false) {
    const mascotaId = this.consulta()?.mascotaId;
    if (mascotaId) this.loadPreventivos(mascotaId);
    if (actualizaVersionConsulta) {
      this.sincronizarVersionConsulta();
    }
    this.msgService.add({ severity: 'success', summary: 'Guardado', detail: mensaje });
  }

  private sincronizarVersionConsulta() {
    const formularioTeniaCambios = this.form.dirty;
    this.hcService.getConsulta(this.consultaId).subscribe({
      next: (res) => {
        const actual = this.consulta();
        this.consulta.set(actual ? {
          ...actual,
version: res.data.version,
          vacunacionAplicada: res.data.vacunacionAplicada,
          observacionVacunacion: res.data.observacionVacunacion,
          desparasitacionAplicada: res.data.desparasitacionAplicada,
          observacionDesparasitacion: res.data.observacionDesparasitacion
        } : res.data);

        this.syncingForm = true;
        this.form.patchValue({
version: res.data.version,
          vacunacionAplicada: res.data.vacunacionAplicada ?? false,
          observacionVacunacion: res.data.observacionVacunacion ?? '',
          desparasitacionAplicada: res.data.desparasitacionAplicada ?? false,
          observacionDesparasitacion: res.data.observacionDesparasitacion ?? ''
        }, { emitEvent: false });
        if (formularioTeniaCambios) {
          this.form.markAsDirty();
        } else {
          this.form.markAsPristine();
        }
        this.syncingForm = false;
        if (formularioTeniaCambios && this.autoSaveStatus() === 'error' && this.form.valid) {
          this.guardarSilencioso(false).subscribe();
        }
      },
      error: () => {
        this.autoSaveStatus.set('error');
        this.msgService.add({
          severity: 'warn',
          summary: 'Cambios pendientes',
          detail: 'El control se guardó, pero no se pudo sincronizar la consulta. No recargues la página; usa Reintentar.'
        });
      }
    });
  }

  private fechaHoy(): string {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  private aplicarEstadoEdicionFormulario() {
    if (this.puedeEditarConsulta()) {
      this.form.enable({ emitEvent: false });
    } else {
      this.form.disable({ emitEvent: false });
    }
    this.form.get('motivoConsulta')?.disable({ emitEvent: false });
  }

  private setupAutosave() {
    this.autosaveSub = this.form.valueChanges.pipe(
      debounceTime(1200),
      tap(() => {
        if (!this.syncingForm && this.puedeEditarConsulta() && this.form.dirty && this.form.invalid) {
          this.form.markAllAsTouched();
          this.autoSaveStatus.set('invalid');
        }
      }),
      filter(() => !this.syncingForm && this.puedeEditarConsulta() && this.form.dirty && this.form.valid),
      concatMap(() => this.guardarSilencioso(false))
    ).subscribe();
  }

  private puedeEditarConsulta(): boolean {
    return this.canEditConsulta();
  }

  loadRecetas() {
    this.hcService.listarRecetas(this.consultaId).subscribe({
      next: (res) => this.recetas.set(res.data ?? [])
    });
  }

  loadArchivos() {
    this.hcService.listarArchivos(this.consultaId).subscribe({
      next: (res) => this.archivos.set(res.data ?? [])
    });
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) {
      this.archivoPendiente.set(input.files[0]);
    }
    input.value = '';
  }

  subirArchivo() {
    if (!this.canCreateArchivo()) return;
    const file = this.archivoPendiente();
    if (!file) return;
    const descripcion = normalizeText(this.descripcionArchivo());
    if (descripcion && (descripcion.length > 300 || !hasMeaningfulText(descripcion))) {
      this.msgService.add({
        severity: 'warn',
        summary: 'Descripcion invalida',
        detail: 'La descripcion del archivo debe contener texto real y no superar 300 caracteres.'
      });
      return;
    }
    this.archivoSubiendo.set(true);
    this.hcService.subirArchivo(this.consultaId, file, this.tipoSeleccionado(), descripcion || undefined).subscribe({
      next: () => {
        this.msgService.add({ severity: 'success', summary: 'Examen', detail: 'Archivo subido correctamente' });
        this.archivoPendiente.set(null);
        this.descripcionArchivo.set('');
        this.archivoSubiendo.set(false);
        this.loadArchivos();
      },
      error: (err) => {
        this.msgService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo subir el archivo' });
        this.archivoSubiendo.set(false);
      }
    });
  }

  visualizarArchivo(archivo: ArchivoClinicoResponse) {
    const ext = archivo.nombre?.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'dcm') {
      this.previewArchivo.set(archivo);
      this.previewTipo.set('dcm');
      this.previewUrl.set('');
      return;
    }
    this.hcService.obtenerContenidoArchivo(this.consultaId, archivo.id).subscribe({
      next: (blob) => {
        if (this.previewRawUrl()) URL.revokeObjectURL(this.previewRawUrl());
        const objectUrl = URL.createObjectURL(blob);
        this.previewRawUrl.set(objectUrl);
        this.previewUrl.set(ext === 'pdf'
          ? this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl)
          : objectUrl);
        this.previewArchivo.set(archivo);
        this.previewTipo.set(ext === 'pdf' ? 'pdf' : 'imagen');
      },
      error: () => this.msgService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar el archivo' })
    });
  }

  cerrarPreview() {
    if (this.previewRawUrl()) URL.revokeObjectURL(this.previewRawUrl());
    this.previewRawUrl.set('');
    this.previewUrl.set('');
    this.previewArchivo.set(null);
    this.previewTipo.set(null);
  }

  descargarArchivo(archivo: ArchivoClinicoResponse) {
    this.hcService.obtenerContenidoArchivo(this.consultaId, archivo.id, true).subscribe({
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

  confirmarEliminarArchivo(archivo: ArchivoClinicoResponse) {
    if (!this.canDeleteArchivo()) return;
    this.archivoEliminando.set(archivo);
    this.showConfirmEliminarArchivo.set(true);
  }

  eliminarArchivo() {
    if (!this.canDeleteArchivo()) return;
    const archivo = this.archivoEliminando();
    if (!archivo) return;
    this.hcService.eliminarArchivo(this.consultaId, archivo.id).subscribe({
      next: () => {
        this.msgService.add({ severity: 'success', summary: 'Examen', detail: 'Archivo eliminado' });
        this.showConfirmEliminarArchivo.set(false);
        this.archivoEliminando.set(null);
        this.loadArchivos();
      },
      error: (err) => this.msgService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo eliminar el archivo' })
    });
  }

  formatBytes(bytes?: number): string {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  iconoTipo(tipo: string): string {
    const map: Record<string, string> = {
      LABORATORIO: 'pi-microchip', RADIOGRAFIA: 'pi-eye', ECOGRAFIA: 'pi-wave-pulse',
      IMAGEN: 'pi-image', OTRO: 'pi-file', PDF: 'pi-file-pdf'
    };
    return map[tipo] ?? 'pi-file';
  }

  abrirNuevaReceta() {
    if (!this.canCreateReceta()) return;
    this.recetaEditando.set(null);
    this.recetaForm.reset({ fechaInicio: new Date().toISOString().split('T')[0] });
    this.showRecetaModal.set(true);
  }

  abrirEditarReceta(receta: PrescripcionResponse) {
    if (!this.canModifyReceta()) return;
    this.recetaEditando.set(receta);
    this.recetaForm.patchValue({
      medicamento:       receta.medicamento,
      principioActivo:   receta.principioActivo ?? '',
      dosis:             receta.dosis,
      frecuencia:        receta.frecuencia,
      duracionDias:      receta.duracionDias ?? null,
      viaAdministracion: receta.viaAdministracion,
      instrucciones:     receta.instrucciones ?? '',
      fechaInicio:       receta.fechaInicio,
      fechaFin:          receta.fechaFin ?? '',
    });
    this.showRecetaModal.set(true);
  }

  guardarReceta() {
    if (this.recetaEditando() ? !this.canModifyReceta() : !this.canCreateReceta()) return;
    if (this.recetaForm.invalid) {
      this.recetaForm.markAllAsTouched();
      return;
    }
    const rawPayload = this.recetaForm.value;
    const payload: PrescripcionRequest = {
      ...rawPayload,
      medicamento:     normalizeText(rawPayload.medicamento),
      principioActivo: normalizeText(rawPayload.principioActivo),
      dosis:           normalizeText(rawPayload.dosis),
      frecuencia:      normalizeText(rawPayload.frecuencia),
      instrucciones:   normalizeText(rawPayload.instrucciones)
    };
    if (payload.fechaFin && payload.fechaInicio && payload.fechaFin < payload.fechaInicio) {
      this.msgService.add({ severity: 'warn', summary: 'Fechas invalidas', detail: 'La fecha de fin no puede ser anterior a la fecha de inicio.' });
      return;
    }
    if (!payload.fechaFin) delete payload.fechaFin;
    if (!payload.principioActivo) delete payload.principioActivo;
    if (!payload.instrucciones) delete payload.instrucciones;

    const editando = this.recetaEditando();
    const obs$ = editando
      ? this.hcService.actualizarReceta(editando.id, payload)
      : this.hcService.crearReceta(this.consultaId, payload);

    obs$.subscribe({
      next: () => {
        this.msgService.add({ severity: 'success', summary: 'Receta', detail: editando ? 'Receta actualizada' : 'Receta registrada' });
        this.showRecetaModal.set(false);
        this.loadRecetas();
      },
      error: (err) => {
        this.msgService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo guardar la receta' });
      }
    });
  }

  confirmarEliminarReceta(receta: PrescripcionResponse) {
    if (!this.canDeleteReceta()) return;
    this.recetaEliminando.set(receta);
    this.showConfirmEliminar.set(true);
  }

  eliminarReceta() {
    if (!this.canDeleteReceta()) return;
    const receta = this.recetaEliminando();
    if (!receta) return;
    this.hcService.eliminarReceta(receta.id).subscribe({
      next: () => {
        this.msgService.add({ severity: 'success', summary: 'Receta', detail: 'Receta eliminada' });
        this.showConfirmEliminar.set(false);
        this.recetaEliminando.set(null);
        this.loadRecetas();
      },
      error: (err) => {
        this.msgService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo eliminar la receta' });
      }
    });
  }

  imprimirRecetas() {
    const consulta = this.consulta();
    const recetas = this.recetas();
    if (!consulta || recetas.length === 0) return;
    const indicacionesGenerales = this.form.get('indicacionesReceta')?.value || consulta.indicacionesReceta || '';

    const hoy = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
    const vetNombre = recetas[0].veterinarioNombre ?? consulta.veterinarioNombre ?? 'Médico Veterinario';

    const medicamentosHtml = recetas.map((r, i) => `
      <div class="rx-box">
        <div class="rx-num">${i + 1}.</div>
        <div class="rx-med">℞ &nbsp;${r.medicamento}${r.principioActivo ? ' <span style="font-size:12px;color:#64748b;font-weight:normal;">(' + r.principioActivo + ')</span>' : ''}</div>
        <div class="rx-detail">
          <div class="item"><label>Dosis</label><p>${r.dosis}</p></div>
          <div class="item"><label>Frecuencia</label><p>${r.frecuencia}</p></div>
          <div class="item"><label>Duración</label><p>${r.duracionDias ? r.duracionDias + ' días' : '—'}</p></div>
          <div class="item"><label>Vía</label><p>${r.viaAdministracion}</p></div>
        </div>
        ${r.instrucciones ? '<div class="indicaciones"><strong>Indicaciones:</strong> ' + r.instrucciones + '</div>' : ''}
      </div>
    `).join('');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Receta Médica</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; padding: 32px; }
    .header { border-bottom: 2px solid #0066AA; padding-bottom: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
    .logo-area h1 { font-size: 20px; font-weight: bold; color: #0066AA; }
    .logo-area p { font-size: 11px; color: #64748b; margin-top: 2px; }
    .fecha { font-size: 11px; color: #64748b; text-align: right; }
    .section { margin-bottom: 16px; }
    .section-title { font-size: 10px; font-weight: bold; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .field label { font-size: 10px; color: #94a3b8; font-weight: bold; }
    .field p { font-size: 12px; color: #1e293b; font-weight: bold; margin-top: 2px; }
    .rx-box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 12px; position: relative; }
    .rx-num { font-size: 10px; color: #94a3b8; font-weight: bold; margin-bottom: 4px; }
    .rx-med { font-size: 15px; font-weight: bold; color: #0066AA; margin-bottom: 8px; }
    .rx-detail { display: flex; gap: 24px; margin-bottom: 8px; }
    .rx-detail .item label { font-size: 10px; color: #94a3b8; font-weight: bold; }
    .rx-detail .item p { font-size: 12px; font-weight: bold; }
    .indicaciones { background: #f8fafc; border-radius: 6px; padding: 10px; margin-top: 8px; font-size: 11px; color: #475569; font-style: italic; }
    .firma { margin-top: 48px; text-align: right; }
    .firma .line { border-top: 1px solid #1e293b; width: 220px; display: inline-block; margin-bottom: 4px; }
    .firma p { font-size: 11px; color: #475569; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-area">
      <h1>Clínica Veterinaria Vargas Vet</h1>
      <p>Receta Médica Veterinaria</p>
    </div>
    <div class="fecha">
      <p>Fecha: <strong>${hoy}</strong></p>
      <p>HC: <strong>${consulta.numeroHc ?? '—'}</strong></p>
    </div>
  </div>
  <div class="section">
    <div class="section-title">Datos del paciente</div>
    <div class="grid-2">
      <div class="field"><label>Paciente</label><p>${consulta.mascotaNombre ?? '—'}</p></div>
      <div class="field"><label>Especie / Raza</label><p>${consulta.especie ?? '—'} · ${consulta.raza ?? '—'}</p></div>
      <div class="field"><label>Propietario</label><p>${consulta.apoderadoNombre ?? '—'}</p></div>
      <div class="field"><label>Teléfono</label><p>${consulta.apoderadoTelefono ?? '—'}</p></div>
    </div>
  </div>
  <div class="section">
    <div class="section-title">Medicamentos prescritos (${recetas.length})</div>
    ${medicamentosHtml}
  </div>
  ${indicacionesGenerales ? `<div class="section"><div class="section-title">Indicaciones generales</div><div style="background:#f8fafc;border-radius:6px;padding:12px;font-size:12px;color:#334155;line-height:1.6;">${indicacionesGenerales}</div></div>` : ''}
  <div class="firma">
    <div class="line"></div><br>
    <p><strong>${vetNombre}</strong></p>
    <p>Médico Veterinario</p>
  </div>
</body>
</html>`;

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;';
    document.body.appendChild(iframe);
    iframe.contentDocument!.open();
    iframe.contentDocument!.write(html);
    iframe.contentDocument!.close();
    iframe.contentWindow!.onafterprint = () => document.body.removeChild(iframe);
    setTimeout(() => iframe.contentWindow!.print(), 300);
  }

  private guardarSilencioso(mostrarError: boolean): Observable<boolean> {
    if (!this.canEditConsulta()) return of(false);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.autoSaveStatus.set('invalid');
      return of(false);
    }
    const version = this.consulta()?.version;
    if (version === undefined) return of(false);

    this.autoSaveStatus.set('saving');
    const payload = this.buildConsultaPayload(version);
    return this.hcService.updateConsulta(this.consultaId, payload, true).pipe(
      tap((res) => {
        this.sincronizarConsultaGuardada(res.data);
      }),
      map(() => true),
      catchError((err) => {
        this.autoSaveStatus.set('error');
        if (mostrarError) {
          this.msgService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo guardar automaticamente' });
        }
        return of(false);
      })
    );
  }

  confirmarGuardar() {
    if (!this.canEditConsulta()) return;
    this.confirmSvc.confirm({
      message: '¿Deseas guardar los cambios realizados en la consulta?',
      header: 'Guardar cambios',
      icon: 'pi pi-save',
      acceptLabel: 'Sí, guardar',
      rejectLabel: 'No',
      accept: () => this.guardar()
    });
  }

  guardar() {
    if (!this.canEditConsulta()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const version = this.consulta()?.version;
    if (version === undefined) return;

    this.loadingStore.show();
    const payload = this.buildConsultaPayload(this.consulta()?.version);
    this.hcService.updateConsulta(this.consultaId, payload).subscribe({
      next: (res) => {
        this.sincronizarConsultaGuardada(res.data);
        this.msgService.add({ severity: 'success', summary: 'Guardado', detail: 'Consulta actualizada correctamente' });
        this.loadingStore.hide();
      },
      error: (err) => {
        this.msgService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al guardar' });
        this.loadingStore.hide();
      }
    });
  }

  private buildConsultaPayload(version: number | undefined): any {
    const payload = this.trimStringFields({ ...this.form.getRawValue(), version });
    delete payload.motivoConsulta;
    return payload;
  }

  reintentarGuardado() {
    if (!this.canEditConsulta()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.autoSaveStatus.set('invalid');
      return;
    }
    this.guardarSilencioso(true).subscribe();
  }

  confirmarCerrar() {
    if (!this.canEditConsulta()) return;
    this.confirmSvc.confirm({
      message: 'Al cerrar la consulta no podrás modificarla. ¿Deseas continuar?',
      header: 'Cerrar consulta',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, cerrar',
      rejectLabel: 'Cancelar',
      acceptButtonProps: { style: 'background-color: #0066aa; color: white; border: none; font-weight: bold; padding: 0.5rem 1rem; border-radius: 0.375rem;' },
      rejectButtonStyleClass: 'bg-slate-300 hover:bg-slate-400 text-slate-700 font-bold',
      accept: () => this.cerrar()
    });
  }

  private cerrar() {
    if (!this.canEditConsulta()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loadingStore.show();
    this.guardarSilencioso(true).pipe(
      switchMap((guardado) => {
        const version = this.consulta()?.version;
        if (!guardado || version === undefined) return EMPTY;
        return this.hcService.cerrarConsulta(this.consultaId, { version });
      }),
      finalize(() => this.loadingStore.hide())
    ).subscribe({
      next: () => {
        this.msgService.add({ severity: 'success', summary: 'Cerrada', detail: 'La consulta fue cerrada exitosamente' });
        setTimeout(() => this.router.navigateByUrl(this.returnUrl), 1500);
      },
      error: (err) => {
        this.msgService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al cerrar la consulta' });
      }
    });
  }

  private sincronizarConsultaGuardada(data: ConsultaResponse) {
    this.syncingForm = true;
    this.consulta.set(data);
    this.isCerrada.set(data.estado === 'CERRADA');
    this.form.patchValue({ version: data.version }, { emitEvent: false });
    this.form.markAsPristine();
    this.autoSaveStatus.set('saved');
    this.syncingForm = false;
  }

  verConsulta(id: number) {
    const item = this.historia()?.consultas.find((c: any) => c.id === id);
    if (item) {
      this.detalleSeleccionado.set(item);
      this.displayDetalleHistorial.set(true);
    }
  }

  volver() {
    this.router.navigateByUrl(this.returnUrl);
  }

  formatFecha(fecha: string | undefined): string {
    if (!fecha) return '—';
    return new Date(fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  formatFechaHora(fecha: string | undefined): string {
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
}
