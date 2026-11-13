import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { memoPorObjeto } from '../../../core/utils/memo-por-objeto';
import {
  ReactiveFormsModule,
  FormsModule,
  FormBuilder,
  FormGroup,
  Validators
} from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { ToastModule } from 'primeng/toast';
import { CheckboxModule } from 'primeng/checkbox';
import { MultiSelectModule } from 'primeng/multiselect';
import { PaginatorModule } from 'primeng/paginator';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';
import { EspecialidadService } from '../../../core/services/especialidad.service';
import { TipoEmpleadoService } from '../../../core/services/tipo-empleado.service';
import { CompanyService } from '../../../core/services/company.service';
import { ServicioService } from '../../../core/services/servicio.service';
import { ControlPreventivoService } from '../../../core/services/control-preventivo.service';
import { ServicioResponse } from '../../../models/response/servicio-response';
import { LoadingStore } from '../../../store/loading.store';
import { AuthStore } from '../../../store/auth.store';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { noLeadingTrailingSpaceValidator } from '../../../core/validators/no-leading-trailing-space.validator';
import { lettersOnlyValidator } from '../../../core/validators/letters-only.validator';
import { textContentValidator } from '../../../core/validators/text-content.validator';
import { ClinicalTemplateService } from '../../../core/services/clinical-template.service';
import {
  ClinicalConcept,
  ClinicalTemplateField,
  ClinicalTemplateResponse,
  ClinicalTemplateSummary,
  ClinicalValueType
} from '../../../models/clinical-template';


@Component({
  selector: 'app-complementario',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    TableModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    InputNumberModule,
    ToastModule,
    CheckboxModule,
    MultiSelectModule,
    PaginatorModule,
    SkeletonModule,
    HasPermissionDirective
  ],
  providers: [MessageService],
  templateUrl: './complementario.component.html',
  styleUrl: './complementario.component.scss'
})
export class ComplementarioComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly especialidadService = inject(EspecialidadService);
  private readonly tipoEmpleadoService = inject(TipoEmpleadoService);
  private readonly companyService = inject(CompanyService);
  private readonly servicioService = inject(ServicioService);
  private readonly controlPreventivoService = inject(ControlPreventivoService);
  private readonly clinicalTemplateService = inject(ClinicalTemplateService);
  private readonly messageService = inject(MessageService);
  readonly authStore = inject(AuthStore);
  readonly loadingStore = inject(LoadingStore);
  private lastLoadedCompanyId: number | null | undefined = undefined;

  get activeCompanyId(): number | null {
    return this.authStore.selectedEnterprise()?.establishmentId ?? this.authStore.companyId();
  }

  get requiresCompanySelection(): boolean {
    return this.authStore.isSuperAdmin() && !this.activeCompanyId;
  }

  constructor() {
    effect(() => {
      const companyId = this.activeCompanyId;
      if (this.lastLoadedCompanyId === companyId) return;

      this.lastLoadedCompanyId = companyId;
      this.resetPagination();

      if (!companyId) {
        this.clearData();
        return;
      }

      this.loadAll();
    });
  }
  activeTab = signal<number>(0);
  clinicalVersions = signal<ClinicalTemplateSummary[]>([]);
  selectedClinicalTemplateKey = signal<string | null>(null);
  clinicalServiceOptions = signal<ServicioResponse[]>([]);
  clinicalConcepts = signal<ClinicalConcept[]>([]);
  clinicalDraft = signal<ClinicalTemplateResponse | null>(null);
  clinicalLoading = signal(false);
  showClinicalConceptModal = signal(false);
  showClinicalTemplateModal = signal(false);
  showClinicalPreview = signal(false);
  clinicalPreviewTemplate = signal<ClinicalTemplateResponse | null>(null);
  clinicalPreviewSpecies = signal('PERRO');
  clinicalSectionExpanded: Record<number, boolean> = {};
  selectedConceptBySection: Record<number, number | null> = {};
  readonly speciesOptions = ['PERRO', 'GATO', 'AVE', 'REPTIL', 'ROEDOR', 'EXOTICO', 'OTRO'];
  readonly speciesSelectOptions = [
    { label: 'Perro', value: 'PERRO' },
    { label: 'Gato', value: 'GATO' },
    { label: 'Ave', value: 'AVE' },
    { label: 'Reptil', value: 'REPTIL' },
    { label: 'Roedor', value: 'ROEDOR' },
    { label: 'Exótico', value: 'EXOTICO' },
    { label: 'Otro', value: 'OTRO' }
  ];
  readonly clinicalValueTypes: Array<{ value: ClinicalValueType; label: string }> = [
    { value: 'TEXT_SHORT', label: 'Texto corto' },
    { value: 'TEXT_LONG', label: 'Texto largo' },
    { value: 'INTEGER', label: 'Número entero' },
    { value: 'DECIMAL', label: 'Número decimal' },
    { value: 'BOOLEAN', label: 'Sí / No' },
    { value: 'DATE', label: 'Fecha' },
    { value: 'SELECT_ONE', label: 'Lista de una opción' },
    { value: 'SELECT_MULTIPLE', label: 'Lista de varias opciones' },
    { value: 'SCALE', label: 'Escala numérica' }
  ];
  readonly clinicalCatalog = computed(() => {
    const byKey = new Map<string, ClinicalTemplateSummary[]>();
    for (const version of this.clinicalVersions()) {
      const versions = byKey.get(version.templateKey) ?? [];
      versions.push(version);
      byKey.set(version.templateKey, versions);
    }
    return Array.from(byKey.entries()).map(([templateKey, versions]) => {
      const draft = versions.find(item => item.status === 'DRAFT');
      const published = versions.find(item => item.status === 'PUBLISHED');
      const representative = draft ?? published ?? versions[0];
      return { templateKey, versions, draft, published, representative };
    }).sort((a, b) => Number(Boolean(b.published?.defaultTemplate)) - Number(Boolean(a.published?.defaultTemplate))
      || a.representative.name.localeCompare(b.representative.name));
  });
  clinicalTemplateForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(160)]],
    description: ['', Validators.maxLength(500)],
    species: [[] as string[]],
    serviceIds: [[] as number[]]
  });
  clinicalConceptForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(160)]],
    description: ['', Validators.maxLength(500)],
    valueType: ['TEXT_SHORT' as ClinicalValueType, Validators.required],
    unit: ['', Validators.maxLength(40)],
    reportable: [true],
    optionsText: ['']
  });
  cargando = signal<boolean>(true);
  confirmDialog = signal<{
    title: string;
    message: string;
    action: string;
    item: any;
    variant: 'primary' | 'warning' | 'danger';
    confirmLabel: string;
  } | null>(null);

  openConfirm(
    title: string,
    message: string,
    action: string,
    item: any,
    variant?: 'primary' | 'warning' | 'danger',
    confirmLabel?: string
  ) {
    const resolvedVariant = variant ?? (action.includes('eliminar') ? 'danger' : action.includes('estado') || action.includes('toggle') ? 'warning' : 'primary');
    const resolvedLabel = confirmLabel ?? (resolvedVariant === 'danger' ? 'Eliminar' : 'Confirmar');
    this.confirmDialog.set({ title, message, action, item, variant: resolvedVariant, confirmLabel: resolvedLabel });
  }

  cancelConfirm() {
    this.confirmDialog.set(null);
  }

  confirmAction() {
    const ctx = this.confirmDialog();
    if (!ctx) return;
    this.cancelConfirm();
    switch (ctx.action) {
      case 'guardar-especialidad': this.saveEspecialidad(); break;
      case 'eliminar-especialidad': this.eliminarEspecialidad(ctx.item.id); break;
      case 'guardar-tipo-empleado': this.saveTipoEmpleado(); break;
      case 'eliminar-tipo-empleado': this.eliminarTipoEmpleado(ctx.item.id); break;
      case 'cambiar-estado-tipo': this.cambiarEstadoTipo(ctx.item); break;
      case 'guardar-servicio': this.saveServicio(); break;
      case 'eliminar-servicio': this.eliminarServicio(ctx.item.id); break;
      case 'toggle-servicio': this.toggleServicioDisponible(ctx.item); break;
      case 'guardar-vacuna': this.saveVacuna(ctx.item); break;
      case 'toggle-vacuna': this.cambiarEstadoVacuna(ctx.item); break;
      case 'eliminar-vacuna': this.eliminarVacuna(ctx.item.id); break;
      case 'guardar-desparasitante': this.saveDesparasitante(ctx.item); break;
      case 'toggle-desparasitante': this.cambiarEstadoDesparasitante(ctx.item); break;
      case 'eliminar-desparasitante': this.eliminarDesparasitante(ctx.item.id); break;
    }
  }

  confirmIconClass(): string {
    const variant = this.confirmDialog()?.variant;
    if (variant === 'danger') return 'bg-red-50 text-red-500';
    if (variant === 'warning') return 'bg-amber-50 text-amber-500';
    return 'bg-blue-50 text-blue-500';
  }

  confirmButtonClass(): string {
    const variant = this.confirmDialog()?.variant;
    const base = 'px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors';
    if (variant === 'danger') return `${base} bg-red-600 hover:bg-red-700`;
    if (variant === 'warning') return `${base} bg-amber-600 hover:bg-amber-700`;
    return `${base} bg-blue-500 hover:bg-blue-600`;
  }

  confirmarGuardarEspecialidad() {
    if (this.espForm.invalid) { this.espForm.markAllAsTouched(); return; }
    const nombre = this.espForm.get('nombre')?.value?.trim();
    const editando = this.editingEsp();
    this.openConfirm(
      editando ? 'Actualizar especialidad' : 'Crear especialidad',
      '¿Está seguro de ' + (editando ? 'actualizar' : 'crear') + ' la especialidad «' + nombre + '»?',
      'guardar-especialidad',
      null
    );
  }

  confirmarGuardarTipoEmpleado() {
    if (this.tipoForm.invalid) { this.tipoForm.markAllAsTouched(); return; }
    const nombre = this.tipoForm.get('nombre')?.value?.trim();
    const editando = this.editingTipo();
    this.openConfirm(
      editando ? 'Actualizar tipo de empleado' : 'Crear tipo de empleado',
      '¿Está seguro de ' + (editando ? 'actualizar' : 'crear') + ' el tipo de empleado «' + nombre + '»?',
      'guardar-tipo-empleado',
      null,
      'primary',
      editando ? 'Actualizar' : 'Crear'
    );
  }

  confirmarCambiarEstadoTipo(item: any) {
    const nuevoEstado = !item.estado;
    this.openConfirm(
      nuevoEstado ? 'Activar tipo de empleado' : 'Desactivar tipo de empleado',
      'El tipo de empleado "' + item.nombre + '" quedara ' + (nuevoEstado ? 'activo' : 'inactivo') + '.',
      'cambiar-estado-tipo',
      item,
      'warning',
      nuevoEstado ? 'Activar' : 'Desactivar'
    );
  }

  confirmarEliminarTipoEmpleado(item: any) {
    this.openConfirm(
      'Eliminar tipo de empleado',
      'Se eliminara el tipo de empleado "' + item.nombre + '". Esta accion no se puede deshacer.',
      'eliminar-tipo-empleado',
      item,
      'danger',
      'Eliminar'
    );
  }

  confirmarGuardarServicio() {
    if (this.servicioForm.invalid) { this.servicioForm.markAllAsTouched(); return; }
    const nombre = this.servicioForm.get('nombre')?.value?.trim();
    const editando = this.editingServicio();
    this.openConfirm(
      editando ? 'Actualizar servicio' : 'Crear servicio',
      '¿Está seguro de ' + (editando ? 'actualizar' : 'crear') + ' el servicio «' + nombre + '»?',
      'guardar-servicio',
      null
    );
  }

  especialidades = signal<any[]>([]);
  especialidadesCatalogo = signal<any[]>([]);
  especialidadesActivas = computed(() => this.especialidadesCatalogo());
  especialidadesTotal = signal(0);
  especialidadesPage = signal(0);
  showEspModal = signal(false);
  editingEsp = signal<any | null>(null);
  espForm: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100), noLeadingTrailingSpaceValidator(), lettersOnlyValidator()]],
    descripcion: ['', [Validators.maxLength(500), noLeadingTrailingSpaceValidator(), textContentValidator()]]
  });
  tiposEmpleado = signal<any[]>([]);
  tiposEmpleadoCatalogo = signal<any[]>([]);
  tiposEmpleadoTotal = signal(0);
  tiposEmpleadoPage = signal(0);
  tiposEmpleadoActivos = computed(() => this.tiposEmpleadoCatalogo().filter(t => t.estado !== false));
  showTipoModal = signal(false);
  editingTipo = signal<any | null>(null);
  tipoForm: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100), noLeadingTrailingSpaceValidator(), lettersOnlyValidator()]],
    descripcion: ['', [Validators.maxLength(500), noLeadingTrailingSpaceValidator(), textContentValidator()]],
    permiteEspecialidades: [false],
    esVeterinario: [false]
  });


  servicios           = signal<ServicioResponse[]>([]);
  serviciosTotal      = signal(0);
  serviciosPage       = signal(0);
  pageSize            = signal(10);
  readonly pageSizeOptions = [10, 20, 50, 100];
  showServicioModal   = signal(false);
  editingServicio     = signal<ServicioResponse | null>(null);
  servicioForm: FormGroup = this.fb.group({
    nombre:      ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80), noLeadingTrailingSpaceValidator(), lettersOnlyValidator()]],
    descripcion: ['', [Validators.required, Validators.maxLength(300), noLeadingTrailingSpaceValidator(), textContentValidator()]],
    precio:      [null, [Validators.required, Validators.min(5), Validators.max(5000)]],
    duracionEstimada: [20, [Validators.required, Validators.min(5), Validators.max(240)]],
    disponible:  [true],
    permiteEmergencia: [false],
    tipoEmpleadoId: [null],
    especialidadId: [null],
    tipoControlPreventivo: ['NO_APLICA']
  });

  vacunas           = signal<any[]>([]);
  vacunasTotal      = signal(0);
  vacunasPage       = signal(0);
  showVacunaModal   = signal(false);
  editingVacuna     = signal<any | null>(null);
  vacunaForm: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    especie: ['', Validators.required],
    precio: [null, [Validators.required, Validators.min(1)]],
    periodicidadMesesSugerida: [null],
    lote: ['', Validators.maxLength(80)],
    fechaVencimientoProducto: [null],
    dosis: [null],
    unidadDosis: ['', Validators.maxLength(30)],
    viaAdministracion: ['', Validators.maxLength(50)]
  });

  desparasitantes           = signal<any[]>([]);
  desparasitantesTotal      = signal(0);
  desparasitantesPage       = signal(0);
  showDesparasitanteModal   = signal(false);
  editingDesparasitante     = signal<any | null>(null);
  desparasitanteForm: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    especie: ['', Validators.required],
    precio: [null, [Validators.required, Validators.min(1)]],
    periodicidadMesesSugerida: [null],
    lote: ['', Validators.maxLength(80)],
    fechaVencimientoProducto: [null],
    dosis: [null],
    unidadDosis: ['', Validators.maxLength(30)],
    viaAdministracion: ['', Validators.maxLength(50)]
  });

  ngOnInit() {
    this.servicioForm.get('tipoEmpleadoId')?.valueChanges.subscribe(() => {
      if (!this.tipoServicioPermiteEspecialidades()) {
        this.servicioForm.get('especialidadId')?.setValue(null, { emitEvent: false });
      }
      if (!this.tipoServicioEsClinico()) {
        this.servicioForm.get('permiteEmergencia')?.setValue(false, { emitEvent: false });
      }
    });
  }

  tipoServicioPermiteEspecialidades(): boolean {
    const tipoId = Number(this.servicioForm.get('tipoEmpleadoId')?.value);
    return this.tiposEmpleadoActivos().some(tipo =>
      tipo.id === tipoId && tipo.permiteEspecialidades === true);
  }

  tipoServicioEsClinico(): boolean {
    const tipoId = Number(this.servicioForm.get('tipoEmpleadoId')?.value);
    return this.tiposEmpleadoActivos().some(tipo =>
      tipo.id === tipoId && Boolean(tipo.ejerceComoVeterinario ?? tipo.esVeterinario));
  }

  loadAll() {
    if (!this.activeCompanyId) {
      this.clearData();
      return;
    }

    this.cargando.set(true);
    this.loadEspecialidades();
    this.loadEspecialidadesCatalogo();
    this.loadTiposEmpleado();
    this.loadTiposEmpleadoCatalogo();
    this.loadServicios();
    this.loadVacunas();
    this.loadDesparasitantes();
    this.loadClinicalConfiguration();
    setTimeout(() => this.cargando.set(false), 500);
  }

  selectTab(index: number) {
    this.activeTab.set(index);
    if (index === 5 && this.clinicalVersions().length === 0) {
      this.loadClinicalConfiguration();
    }
  }

  loadClinicalConfiguration() {
    if (!this.activeCompanyId) return;
    this.clinicalTemplateService.list().subscribe({
      next: response => {
        this.clinicalVersions.set(response.data ?? []);
        const versions = response.data ?? [];
        let selectedKey = this.selectedClinicalTemplateKey();
        if (!selectedKey || !versions.some(version => version.templateKey === selectedKey)) {
          selectedKey = versions.find(version => version.status === 'PUBLISHED' && version.defaultTemplate)?.templateKey
            ?? versions[0]?.templateKey ?? null;
          this.selectedClinicalTemplateKey.set(selectedKey);
        }
        const draft = versions.find(version => version.templateKey === selectedKey && version.status === 'DRAFT');
        if (draft) this.loadClinicalDraft(draft.id);
        else this.clinicalDraft.set(null);
      },
      error: () => this.clinicalVersions.set([])
    });
    this.clinicalTemplateService.concepts().subscribe({
      next: response => this.clinicalConcepts.set(response.data ?? []),
      error: () => this.clinicalConcepts.set([])
    });
    this.servicioService.listarDisponibles(this.activeCompanyId ?? undefined).subscribe({
      next: response => this.clinicalServiceOptions.set(response.data ?? []),
      error: () => this.clinicalServiceOptions.set([])
    });
  }

  selectClinicalTemplate(templateKey: string) {
    this.selectedClinicalTemplateKey.set(templateKey);
    const draft = this.clinicalVersions().find(item => item.templateKey === templateKey && item.status === 'DRAFT');
    if (draft) this.loadClinicalDraft(draft.id);
    else this.clinicalDraft.set(null);
  }

  readonly selectedClinicalVersions = computed(() =>
    this.clinicalVersions().filter(version => version.templateKey === this.selectedClinicalTemplateKey())
  );

  readonly selectedClinicalPublished = computed(() =>
    this.selectedClinicalVersions().find(version => version.status === 'PUBLISHED')
  );

  toggleClinicalSelectAll<T>(selected: T[] | null | undefined, options: readonly T[]): T[] {
    const allSelected = options.length > 0 && options.every(option => selected?.includes(option));
    return allSelected ? [] : [...options];
  }

  areAllClinicalOptionsSelected<T>(selected: T[] | null | undefined, options: readonly T[]): boolean {
    return options.length > 0 && options.every(option => selected?.includes(option));
  }

  loadClinicalDraft(id: number) {
    this.clinicalLoading.set(true);
    this.clinicalTemplateService.get(id).subscribe({
      next: response => {
        this.clinicalDraft.set(this.cloneClinicalTemplate(response.data));
        this.initializeClinicalSections(response.data);
        this.clinicalLoading.set(false);
      },
      error: () => {
        this.clinicalLoading.set(false);
        this.messageService.add({ severity: 'error', summary: 'Ficha clínica', detail: 'No se pudo cargar el borrador.' });
      }
    });
  }

  prepareClinicalDraft() {
    const published = this.selectedClinicalPublished();
    if (!published) return;
    this.clinicalLoading.set(true);
    this.clinicalTemplateService.createDraftFrom(published.id).subscribe({
      next: response => {
        this.clinicalDraft.set(this.cloneClinicalTemplate(response.data));
        this.initializeClinicalSections(response.data);
        this.clinicalLoading.set(false);
        this.loadClinicalConfiguration();
      },
      error: error => {
        this.clinicalLoading.set(false);
        this.messageService.add({ severity: 'error', summary: 'Ficha clínica', detail: error.error?.message || 'No se pudo preparar el borrador.' });
      }
    });
  }

  openClinicalTemplateModal() {
    this.clinicalTemplateForm.reset({ name: '', description: '', species: [], serviceIds: [] });
    this.showClinicalTemplateModal.set(true);
  }

  saveClinicalTemplate() {
    if (this.clinicalTemplateForm.invalid) {
      this.clinicalTemplateForm.markAllAsTouched();
      return;
    }
    const value = this.clinicalTemplateForm.getRawValue();
    this.clinicalLoading.set(true);
    this.clinicalTemplateService.create({
      name: value.name!.trim(),
      description: value.description?.trim() || undefined,
      species: value.species ?? [],
      serviceIds: value.serviceIds ?? [],
      copyFromTemplateId: this.selectedClinicalPublished()?.id
    }).subscribe({
      next: response => {
        this.selectedClinicalTemplateKey.set(response.data.templateKey);
        this.clinicalDraft.set(this.cloneClinicalTemplate(response.data));
        this.initializeClinicalSections(response.data);
        this.showClinicalTemplateModal.set(false);
        this.clinicalLoading.set(false);
        this.loadClinicalConfiguration();
        this.messageService.add({ severity: 'success', summary: 'Ficha creada', detail: 'Puedes personalizarla antes de publicarla.' });
      },
      error: error => {
        this.clinicalLoading.set(false);
        this.messageService.add({ severity: 'error', summary: 'Ficha clínica', detail: error.error?.message || 'No se pudo crear la ficha.' });
      }
    });
  }

  makeClinicalTemplateDefault() {
    const published = this.selectedClinicalPublished();
    if (!published || published.defaultTemplate) return;
    this.clinicalTemplateService.makeDefault(published.id).subscribe({
      next: () => {
        this.loadClinicalConfiguration();
        this.messageService.add({ severity: 'success', summary: 'Ficha predeterminada', detail: 'Se usará cuando no exista una coincidencia específica.' });
      },
      error: error => this.messageService.add({ severity: 'error', summary: 'Ficha clínica', detail: error.error?.message || 'No se pudo actualizar.' })
    });
  }

  addClinicalSection() {
    const draft = this.clinicalDraft();
    if (!draft) return;
    const sectionId = -Date.now();
    draft.sections.push({ id: sectionId, title: 'Nueva sección', order: draft.sections.length, fields: [] });
    this.clinicalSectionExpanded[sectionId] = true;
    this.clinicalDraft.set(this.cloneClinicalTemplate(draft));
  }

  toggleClinicalSection(sectionId: number) {
    this.clinicalSectionExpanded[sectionId] = !this.isClinicalSectionExpanded(sectionId);
  }

  isClinicalSectionExpanded(sectionId: number): boolean {
    return this.clinicalSectionExpanded[sectionId] !== false;
  }

  setAllClinicalSectionsExpanded(expanded: boolean) {
    this.clinicalDraft()?.sections.forEach(section => this.clinicalSectionExpanded[section.id] = expanded);
  }

  removeClinicalSection(sectionIndex: number) {
    const draft = this.clinicalDraft();
    if (!draft) return;
    draft.sections.splice(sectionIndex, 1);
    this.normalizeClinicalOrder(draft);
  }

  addClinicalField(sectionIndex: number) {
    const draft = this.clinicalDraft();
    const conceptId = this.selectedConceptBySection[sectionIndex];
    const concept = this.clinicalConcepts().find(item => item.id === Number(conceptId));
    const section = draft?.sections[sectionIndex];
    if (!draft || !section || !concept) return;
    if (section.fields.some(field => field.conceptId === concept.id)) {
      this.messageService.add({ severity: 'warn', summary: 'Campo repetido', detail: 'Este campo ya está en la sección.' });
      return;
    }
    section.fields.push({
      id: -Date.now(), conceptId: concept.id, conceptCode: concept.code, label: concept.name,
      helpText: concept.description, valueType: concept.valueType, unit: concept.unit,
      required: false, visible: true, reportable: concept.reportable, order: section.fields.length,
      species: [], validationConfig: concept.validationConfig ?? '{}', visibilityRules: '{}'
    });
    this.selectedConceptBySection[sectionIndex] = null;
    this.clinicalDraft.set(this.cloneClinicalTemplate(draft));
  }

  removeClinicalField(sectionIndex: number, fieldIndex: number) {
    const draft = this.clinicalDraft();
    if (!draft) return;
    draft.sections[sectionIndex]?.fields.splice(fieldIndex, 1);
    this.normalizeClinicalOrder(draft);
  }

  moveClinicalField(sectionIndex: number, fieldIndex: number, direction: -1 | 1) {
    const draft = this.clinicalDraft();
    const fields = draft?.sections[sectionIndex]?.fields;
    const target = fieldIndex + direction;
    if (!draft || !fields || target < 0 || target >= fields.length) return;
    [fields[fieldIndex], fields[target]] = [fields[target], fields[fieldIndex]];
    this.normalizeClinicalOrder(draft);
  }

  saveClinicalDraft() {
    const draft = this.clinicalDraft();
    if (!draft) return;
    if (!draft.name.trim() || draft.sections.some(section => !section.title.trim())) {
      this.messageService.add({ severity: 'warn', summary: 'Datos incompletos', detail: 'La ficha y sus secciones deben tener nombre.' });
      return;
    }
    this.clinicalLoading.set(true);
    this.clinicalTemplateService.updateDraft(draft.id, {
      name: draft.name.trim(),
      description: draft.description?.trim(),
      species: draft.species ?? [],
      serviceIds: draft.serviceIds ?? [],
      sections: draft.sections.map((section, sectionIndex) => ({
        title: section.title.trim(), order: sectionIndex,
        fields: section.fields.map((field, fieldIndex) => ({
          conceptId: field.conceptId, label: field.label.trim(), helpText: field.helpText?.trim(),
          required: field.required, visible: field.visible, order: fieldIndex,
          species: field.species ?? [], visibilityRules: field.visibilityRules ?? '{}'
        }))
      }))
    }).subscribe({
      next: response => {
        this.clinicalDraft.set(this.cloneClinicalTemplate(response.data));
        this.clinicalLoading.set(false);
        this.messageService.add({ severity: 'success', summary: 'Borrador guardado', detail: 'Los cambios todavía no afectan las nuevas consultas.' });
        this.loadClinicalConfiguration();
      },
      error: error => {
        this.clinicalLoading.set(false);
        this.messageService.add({ severity: 'error', summary: 'Ficha clínica', detail: error.error?.message || 'No se pudo guardar el borrador.' });
      }
    });
  }

  publishClinicalDraft() {
    const draft = this.clinicalDraft();
    if (!draft) return;
    this.clinicalLoading.set(true);
    this.clinicalTemplateService.publish(draft.id).subscribe({
      next: response => {
        this.clinicalDraft.set(null);
        this.clinicalLoading.set(false);
        this.messageService.add({ severity: 'success', summary: 'Ficha publicada', detail: `La versión ${response.data.version} se usará en las nuevas consultas.` });
        this.loadClinicalConfiguration();
      },
      error: error => {
        this.clinicalLoading.set(false);
        this.messageService.add({ severity: 'error', summary: 'Ficha clínica', detail: error.error?.message || 'No se pudo publicar la ficha.' });
      }
    });
  }

  openClinicalConceptModal() {
    this.clinicalConceptForm.reset({ name: '', description: '', valueType: 'TEXT_SHORT', unit: '', reportable: true, optionsText: '' });
    this.showClinicalConceptModal.set(true);
  }

  openClinicalPreview() {
    const draft = this.clinicalDraft();
    if (draft) {
      this.clinicalPreviewTemplate.set(this.cloneClinicalTemplate(draft));
      this.showClinicalPreview.set(true);
      return;
    }

    const published = this.selectedClinicalPublished();
    if (!published) {
      this.messageService.add({
        severity: 'info',
        summary: 'Vista previa no disponible',
        detail: 'Primero configura una ficha clínica.'
      });
      return;
    }

    this.clinicalLoading.set(true);
    this.clinicalTemplateService.get(published.id).subscribe({
      next: response => {
        this.clinicalPreviewTemplate.set(this.cloneClinicalTemplate(response.data));
        this.showClinicalPreview.set(true);
        this.clinicalLoading.set(false);
      },
      error: () => {
        this.clinicalLoading.set(false);
        this.messageService.add({ severity: 'error', summary: 'Vista previa', detail: 'No se pudo cargar la ficha vigente.' });
      }
    });
  }

  closeClinicalPreview() {
    this.showClinicalPreview.set(false);
    this.clinicalPreviewTemplate.set(null);
  }

  isClinicalFieldVisibleForPreview(field: ClinicalTemplateField): boolean {
    if (!field.visible) return false;
    const species = field.species ?? [];
    return species.length === 0 || species.includes(this.clinicalPreviewSpecies());
  }

  private readonly configDelCampo = memoPorObjeto((field: ClinicalTemplateField): Record<string, any> => {
    try {
      const config = JSON.parse(field.validationConfig ?? '{}');
      return config !== null && typeof config === 'object' ? config : {};
    } catch {
      return {};
    }
  }, field => field.validationConfig);

  private readonly opcionesDelCampo = memoPorObjeto((field: ClinicalTemplateField): string[] => {
    const config = this.configDelCampo(field);
    return Array.isArray(config['options']) ? config['options'].map(String) : [];
  }, field => field.validationConfig);

  private readonly escalaDelCampo = memoPorObjeto((field: ClinicalTemplateField): { min: number; max: number } => {
    const config = this.configDelCampo(field);
    return {
      min: Number.isFinite(Number(config['min'])) ? Number(config['min']) : 1,
      max: Number.isFinite(Number(config['max'])) ? Number(config['max']) : 10
    };
  }, field => field.validationConfig);

  clinicalPreviewOptions(field: ClinicalTemplateField): string[] {
    return this.opcionesDelCampo(field);
  }

  clinicalPreviewScale(field: ClinicalTemplateField): { min: number; max: number } {
    return this.escalaDelCampo(field);
  }

  saveClinicalConcept() {
    if (this.clinicalConceptForm.invalid) {
      this.clinicalConceptForm.markAllAsTouched();
      return;
    }
    const value = this.clinicalConceptForm.getRawValue();
    const options = (value.optionsText ?? '').split(',').map(option => option.trim()).filter(Boolean);
    const needsOptions = value.valueType === 'SELECT_ONE' || value.valueType === 'SELECT_MULTIPLE';
    if (needsOptions && options.length < 2) {
      this.messageService.add({ severity: 'warn', summary: 'Opciones requeridas', detail: 'Agrega al menos dos opciones separadas por comas.' });
      return;
    }
    this.clinicalTemplateService.createConcept({
      name: value.name!, description: value.description || undefined, valueType: value.valueType!,
      unit: value.unit || undefined, reportable: Boolean(value.reportable),
      validationConfig: JSON.stringify(needsOptions ? { options } : {})
    }).subscribe({
      next: response => {
        this.clinicalConcepts.update(items => [...items, response.data]);
        this.showClinicalConceptModal.set(false);
        this.messageService.add({ severity: 'success', summary: 'Campo creado', detail: 'Ya puedes agregarlo a una sección.' });
      },
      error: error => this.messageService.add({ severity: 'error', summary: 'Campo clínico', detail: error.error?.message || 'No se pudo crear el campo.' })
    });
  }

  clinicalStatusLabel(status: ClinicalTemplateSummary['status']): string {
    return status === 'PUBLISHED' ? 'Vigente' : status === 'DRAFT' ? 'Borrador' : 'Anterior';
  }

  isCoreClinicalField(field: ClinicalTemplateField): boolean {
    return Boolean(this.configDelCampo(field)['coreField']);
  }

  private normalizeClinicalOrder(draft: ClinicalTemplateResponse) {
    draft.sections.forEach((section, sectionIndex) => {
      section.order = sectionIndex;
      section.fields.forEach((field, fieldIndex) => field.order = fieldIndex);
    });
    this.clinicalDraft.set(this.cloneClinicalTemplate(draft));
  }

  private initializeClinicalSections(template: ClinicalTemplateResponse) {
    const next: Record<number, boolean> = {};
    template.sections.forEach((section, index) => next[section.id] = index === 0);
    this.clinicalSectionExpanded = next;
  }

  private cloneClinicalTemplate(template: ClinicalTemplateResponse): ClinicalTemplateResponse {
    return JSON.parse(JSON.stringify(template));
  }

  private resetPagination() {
    this.especialidadesPage.set(0);
    this.tiposEmpleadoPage.set(0);
    this.serviciosPage.set(0);
    this.vacunasPage.set(0);
    this.desparasitantesPage.set(0);
  }

  private clearData() {
    this.especialidades.set([]);
    this.especialidadesCatalogo.set([]);
    this.especialidadesTotal.set(0);
    this.tiposEmpleado.set([]);
    this.tiposEmpleadoCatalogo.set([]);
    this.tiposEmpleadoTotal.set(0);
    this.servicios.set([]);
    this.serviciosTotal.set(0);
    this.vacunas.set([]);
    this.vacunasTotal.set(0);
    this.desparasitantes.set([]);
    this.desparasitantesTotal.set(0);
  }

  private pageTotal(data: any): number {
    return data?.page?.totalElements ?? data?.totalElements ?? 0;
  }

  loadEspecialidades(page = this.especialidadesPage()) {
    if (!this.activeCompanyId) return;
    const cid = this.activeCompanyId ?? undefined;
    this.especialidadService.listar(cid, page, this.pageSize()).subscribe({
      next: (res) => {
        this.especialidades.set(res.data.content ?? res.data);
        this.especialidadesTotal.set(this.pageTotal(res.data));
        this.especialidadesPage.set(page);
      },
      error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las especialidades' })
    });
  }

  loadEspecialidadesCatalogo() {
    if (!this.activeCompanyId) return;
    this.especialidadService.listar(this.activeCompanyId, 0, 100).subscribe({
      next: (res) => this.especialidadesCatalogo.set(res.data.content ?? res.data),
      error: () => this.especialidadesCatalogo.set([])
    });
  }

  openEspModal(item?: any) {
    this.editingEsp.set(item ?? null);
    this.espForm.reset({ nombre: item?.nombre ?? '', descripcion: item?.descripcion ?? '' });
    this.showEspModal.set(true);
  }

  saveEspecialidad() {
    if (this.espForm.invalid) { this.espForm.markAllAsTouched(); return; }
    const val = this.espForm.value;
    const companyId = this.activeCompanyId;
    const payload = {
      ...val,
      ...(companyId && !this.editingEsp() ? { company: { id: companyId } } : {})
    };

    const req = this.editingEsp()
      ? this.especialidadService.actualizar(this.editingEsp().id, payload)
      : this.especialidadService.crear(payload);

    this.loadingStore.show();
    req.subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: this.editingEsp() ? 'Especialidad actualizada' : 'Especialidad creada' });
        this.showEspModal.set(false);
        this.loadEspecialidades(this.editingEsp() ? this.especialidadesPage() : 0);
        this.loadEspecialidadesCatalogo();
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al guardar' });
        this.loadingStore.hide();
      }
    });
  }

  eliminarEspecialidad(id: number) {
    this.loadingStore.show();
    this.especialidadService.eliminar(id).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Eliminada', detail: 'Especialidad eliminada' });
        this.loadEspecialidades(this.especialidadesPage());
        this.loadEspecialidadesCatalogo();
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo eliminar la especialidad' });
        this.loadingStore.hide();
      }
    });
  }
  loadTiposEmpleado(page = this.tiposEmpleadoPage()) {
    if (!this.activeCompanyId) return;
    const cid = this.activeCompanyId ?? undefined;
    this.tipoEmpleadoService.listar(cid, page, this.pageSize()).subscribe({
      next: (res) => {
        this.tiposEmpleado.set(res.data.content ?? res.data);
        this.tiposEmpleadoTotal.set(this.pageTotal(res.data));
        this.tiposEmpleadoPage.set(page);
      },
      error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los tipos de empleado' })
    });
  }

  loadTiposEmpleadoCatalogo() {
    if (!this.activeCompanyId) return;
    const cid = this.activeCompanyId ?? undefined;
    this.tipoEmpleadoService.listar(cid, 0, 100).subscribe({
      next: (res) => this.tiposEmpleadoCatalogo.set(res.data.content ?? res.data),
      error: () => this.tiposEmpleadoCatalogo.set([])
    });
  }

  openTipoModal(item?: any) {
    this.editingTipo.set(item ?? null);
    this.tipoForm.reset({
      nombre: item?.nombre ?? '',
      descripcion: item?.descripcion ?? '',
      permiteEspecialidades: item?.permiteEspecialidades ?? false,
      esVeterinario: item?.ejerceComoVeterinario ?? item?.esVeterinario ?? false
    });
    this.showTipoModal.set(true);
  }

  saveTipoEmpleado() {
    if (this.tipoForm.invalid) { this.tipoForm.markAllAsTouched(); return; }
    const val = this.tipoForm.value;
    const companyId = this.activeCompanyId;
    const payload = {
      ...val,
      ...(companyId ? { company: { id: companyId } } : {})
    };

    const editing = this.editingTipo();
    const req = editing
      ? this.tipoEmpleadoService.actualizar(editing.id, payload)
      : this.tipoEmpleadoService.crear(payload);

    this.loadingStore.show();
    req.subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: editing ? 'Tipo de empleado actualizado' : 'Tipo de empleado creado' });
        this.showTipoModal.set(false);
        this.loadTiposEmpleado(editing ? this.tiposEmpleadoPage() : 0);
        this.loadTiposEmpleadoCatalogo();
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al guardar' });
        this.loadingStore.hide();
      }
    });
  }

  cambiarEstadoTipo(item: any) {
    this.loadingStore.show();
    this.tipoEmpleadoService.cambiarEstado(item.id, !item.estado).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Estado actualizado' });
        this.loadTiposEmpleado(this.tiposEmpleadoPage());
        this.loadTiposEmpleadoCatalogo();
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo cambiar el estado' });
        this.loadingStore.hide();
      }
    });
  }

  eliminarTipoEmpleado(id: number) {
    this.loadingStore.show();
    this.tipoEmpleadoService.eliminar(id).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Eliminado', detail: 'Tipo de empleado eliminado' });
        this.loadTiposEmpleado(this.tiposEmpleadoPage());
        this.loadTiposEmpleadoCatalogo();
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo eliminar el tipo de empleado' });
        this.loadingStore.hide();
      }
    });
  }

  loadServicios(page = this.serviciosPage()) {
    if (!this.activeCompanyId) return;
    const cid = this.activeCompanyId ?? undefined;
    this.servicioService.listar(cid, page, this.pageSize()).subscribe({
      next: (res) => {
        // Filter out soft-deleted services so they do not show up in the active list
        const activeList = (res.data.content || []).filter((s: ServicioResponse) => s.activo);
        this.servicios.set(activeList);
        this.serviciosTotal.set(this.pageTotal(res.data));
        this.serviciosPage.set(page);
      },
      error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los servicios' })
    });
  }

  openServicioModal(item?: ServicioResponse) {
    this.editingServicio.set(item ?? null);
    this.servicioForm.reset({
      nombre:      item?.nombre      ?? '',
      descripcion: item?.descripcion ?? '',
      precio:      item?.precio      ?? null,
      duracionEstimada: item?.duracionEstimada ?? 20,
      disponible:  item?.disponible  ?? true,
      permiteEmergencia: item?.permiteEmergencia ?? false,
      tipoEmpleadoId: item?.tipoEmpleadoId ?? null,
      especialidadId: item?.especialidadId ?? null,
      tipoControlPreventivo: item?.tipoControlPreventivo ?? 'NO_APLICA'
    });
    this.showServicioModal.set(true);
  }

  saveServicio() {
    if (this.servicioForm.invalid) { this.servicioForm.markAllAsTouched(); return; }
    const val = this.servicioForm.value;
    const companyId = this.activeCompanyId;
    const payload = { ...val, ...(companyId ? { companyId } : {}) };

    const editing = this.editingServicio();
    const req = editing
      ? this.servicioService.actualizar(editing.id, payload)
      : this.servicioService.crear(payload);

    this.loadingStore.show();
    req.subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: editing ? 'Servicio actualizado' : 'Servicio creado' });
        this.showServicioModal.set(false);
        this.loadServicios(editing ? this.serviciosPage() : 0);
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al guardar' });
        this.loadingStore.hide();
      }
    });
  }

  toggleServicioDisponible(item: ServicioResponse) {
    this.loadingStore.show();
    this.servicioService.toggleDisponible(item.id).subscribe({
      next: () => {
        this.loadServicios(this.serviciosPage());
        this.loadingStore.hide();
        this.messageService.add({ severity: 'success', summary: 'Actualizado', detail: 'Disponibilidad del servicio actualizada' });
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo cambiar la disponibilidad' });
        this.loadingStore.hide();
      }
    });
  }

  eliminarServicio(id: number) {
    this.loadingStore.show();
    this.servicioService.eliminar(id).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Eliminado', detail: 'Servicio eliminado correctamente' });
        this.loadServicios(this.serviciosPage());
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo eliminar el servicio' });
        this.loadingStore.hide();
      }
    });
  }

  onEspecialidadesPageChange(event: any) {
    const nextSize = Number(event.rows) || 10;
    const nextPage = nextSize === this.pageSize() ? Number(event.page) || 0 : 0;
    this.pageSize.set(nextSize);
    this.loadEspecialidades(nextPage);
  }

  onTiposEmpleadoPageChange(event: any) {
    const nextSize = Number(event.rows) || 10;
    const nextPage = nextSize === this.pageSize() ? Number(event.page) || 0 : 0;
    this.pageSize.set(nextSize);
    this.loadTiposEmpleado(nextPage);
  }

  onServiciosPageChange(event: any) {
    const nextSize = Number(event.rows) || 10;
    const nextPage = nextSize === this.pageSize() ? Number(event.page) || 0 : 0;
    this.pageSize.set(nextSize);
    this.loadServicios(nextPage);
  }

  onVacunasPageChange(event: any) {
    const nextSize = Number(event.rows) || 10;
    const nextPage = nextSize === this.pageSize() ? Number(event.page) || 0 : 0;
    this.pageSize.set(nextSize);
    this.loadVacunas(nextPage);
  }

  onDesparasitantesPageChange(event: any) {
    const nextSize = Number(event.rows) || 10;
    const nextPage = nextSize === this.pageSize() ? Number(event.page) || 0 : 0;
    this.pageSize.set(nextSize);
    this.loadDesparasitantes(nextPage);
  }

  private saveVacuna(item: any) {
    const editando = this.editingVacuna();
    const payload = {
      nombre: item.nombre.trim(),
      especie: item.especie,
      precio: item.precio,
      periodicidadMesesSugerida: item.periodicidadMesesSugerida || null,
      lote: item.lote?.trim() || null,
      fechaVencimientoProducto: item.fechaVencimientoProducto || null,
      dosis: item.dosis || null,
      unidadDosis: item.unidadDosis?.trim() || null,
      viaAdministracion: item.viaAdministracion?.trim() || null
    };
    this.loadingStore.show();
    const req$ = editando
      ? this.controlPreventivoService.actualizarTipoVacuna(editando.id, payload)
      : this.controlPreventivoService.crearTipoVacuna(payload);
    req$.subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: editando ? 'Vacuna actualizada' : 'Vacuna creada' });
        this.showVacunaModal.set(false);
        this.loadVacunas(editando ? this.vacunasPage() : 0);
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo guardar' });
        this.loadingStore.hide();
      }
    });
  }

  private cambiarEstadoVacuna(item: any) {
    this.loadingStore.show();
    this.controlPreventivoService.cambiarEstadoTipoVacuna(item.id, !item.activo).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: item.activo ? 'Vacuna desactivada' : 'Vacuna activada' });
        this.loadVacunas(this.vacunasPage());
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo cambiar estado' });
        this.loadingStore.hide();
      }
    });
  }

  private saveDesparasitante(item: any) {
    const editando = this.editingDesparasitante();
    const payload = {
      nombre: item.nombre.trim(),
      especie: item.especie,
      precio: item.precio,
      periodicidadMesesSugerida: item.periodicidadMesesSugerida || null,
      lote: item.lote?.trim() || null,
      fechaVencimientoProducto: item.fechaVencimientoProducto || null,
      dosis: item.dosis || null,
      unidadDosis: item.unidadDosis?.trim() || null,
      viaAdministracion: item.viaAdministracion?.trim() || null
    };
    this.loadingStore.show();
    const req$ = editando
      ? this.controlPreventivoService.actualizarTipoDesparasitante(editando.id, payload)
      : this.controlPreventivoService.crearTipoDesparasitante(payload);
    req$.subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: editando ? 'Desparasitante actualizado' : 'Desparasitante creado' });
        this.showDesparasitanteModal.set(false);
        this.loadDesparasitantes(editando ? this.desparasitantesPage() : 0);
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo guardar' });
        this.loadingStore.hide();
      }
    });
  }

  private cambiarEstadoDesparasitante(item: any) {
    this.loadingStore.show();
    this.controlPreventivoService.cambiarEstadoTipoDesparasitante(item.id, !item.activo).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: item.activo ? 'Desparasitante desactivado' : 'Desparasitante activado' });
        this.loadDesparasitantes(this.desparasitantesPage());
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo cambiar estado' });
        this.loadingStore.hide();
      }
    });
  }

  loadVacunas(page = this.vacunasPage()) {
    if (!this.activeCompanyId) return;
    this.loadingStore.show();
    this.controlPreventivoService.listarTiposVacunaPorCompany(page, this.pageSize()).subscribe({
      next: (res) => {
        this.vacunas.set(res.data?.content ?? []);
        this.vacunasTotal.set(res.data?.page?.totalElements ?? res.data?.totalElements ?? 0);
        this.vacunasPage.set(page);
        this.loadingStore.hide();
      },
      error: () => { this.loadingStore.hide(); }
    });
  }

  loadDesparasitantes(page = this.desparasitantesPage()) {
    if (!this.activeCompanyId) return;
    this.loadingStore.show();
    this.controlPreventivoService.listarTiposDesparasitantePorCompany(page, this.pageSize()).subscribe({
      next: (res) => {
        this.desparasitantes.set(res.data?.content ?? []);
        this.desparasitantesTotal.set(res.data?.page?.totalElements ?? res.data?.totalElements ?? 0);
        this.desparasitantesPage.set(page);
        this.loadingStore.hide();
      },
      error: () => { this.loadingStore.hide(); }
    });
  }

  openVacunaModal(item: any = null) {
    this.editingVacuna.set(item ? { ...item } : null);
    if (item) {
      this.vacunaForm.patchValue({
        nombre: item.nombre ?? '',
        especie: item.especie ?? '',
        precio: item.precio ?? null,
        periodicidadMesesSugerida: item.periodicidadMesesSugerida ?? null,
        lote: item.lote ?? '',
        fechaVencimientoProducto: item.fechaVencimientoProducto ?? null,
        dosis: item.dosis ?? null,
        unidadDosis: item.unidadDosis ?? '',
        viaAdministracion: item.viaAdministracion ?? ''
      });
    } else {
      this.vacunaForm.reset({ nombre: '', especie: '', precio: null, periodicidadMesesSugerida: null, lote: '', fechaVencimientoProducto: null, dosis: null, unidadDosis: '', viaAdministracion: '' });
    }
    this.showVacunaModal.set(true);
  }

  openDesparasitanteModal(item: any = null) {
    this.editingDesparasitante.set(item ? { ...item } : null);
    if (item) {
      this.desparasitanteForm.patchValue({
        nombre: item.nombre ?? '',
        especie: item.especie ?? '',
        precio: item.precio ?? null,
        periodicidadMesesSugerida: item.periodicidadMesesSugerida ?? null,
        lote: item.lote ?? '',
        fechaVencimientoProducto: item.fechaVencimientoProducto ?? null,
        dosis: item.dosis ?? null,
        unidadDosis: item.unidadDosis ?? '',
        viaAdministracion: item.viaAdministracion ?? ''
      });
    } else {
      this.desparasitanteForm.reset({ nombre: '', especie: '', precio: null, periodicidadMesesSugerida: null, lote: '', fechaVencimientoProducto: null, dosis: null, unidadDosis: '', viaAdministracion: '' });
    }
    this.showDesparasitanteModal.set(true);
  }

  confirmarGuardarVacuna() {
    if (this.vacunaForm.invalid) { this.vacunaForm.markAllAsTouched(); return; }
    const nombre = this.vacunaForm.get('nombre')?.value?.trim();
    const editando = this.editingVacuna();
    this.openConfirm(
      editando ? 'Actualizar vacuna' : 'Crear vacuna',
      '¿Está seguro de ' + (editando ? 'actualizar' : 'crear') + ' la vacuna «' + nombre + '»?',
      editando ? 'guardar-vacuna' : 'guardar-vacuna',
      { ...this.vacunaForm.value, id: editando?.id },
      editando ? 'warning' : 'primary',
      editando ? 'Actualizar' : 'Crear'
    );
  }

  confirmarGuardarDesparasitante() {
    if (this.desparasitanteForm.invalid) { this.desparasitanteForm.markAllAsTouched(); return; }
    const nombre = this.desparasitanteForm.get('nombre')?.value?.trim();
    const editando = this.editingDesparasitante();
    this.openConfirm(
      editando ? 'Actualizar desparasitante' : 'Crear desparasitante',
      '¿Está seguro de ' + (editando ? 'actualizar' : 'crear') + ' el desparasitante «' + nombre + '»?',
      editando ? 'guardar-desparasitante' : 'guardar-desparasitante',
      { ...this.desparasitanteForm.value, id: editando?.id },
      editando ? 'warning' : 'primary',
      editando ? 'Actualizar' : 'Crear'
    );
  }

  confirmarToggleEstadoVacuna(item: any) {
    this.openConfirm(
      item.activo ? 'Desactivar vacuna' : 'Activar vacuna',
      '¿Está seguro de ' + (item.activo ? 'desactivar' : 'activar') + ' la vacuna «' + item.nombre + '»?',
      'toggle-vacuna',
      item,
      item.activo ? 'danger' : 'primary',
      item.activo ? 'Desactivar' : 'Activar'
    );
  }

  confirmarToggleEstadoDesparasitante(item: any) {
    this.openConfirm(
      item.activo ? 'Desactivar desparasitante' : 'Activar desparasitante',
      '¿Está seguro de ' + (item.activo ? 'desactivar' : 'activar') + ' el desparasitante «' + item.nombre + '»?',
      'toggle-desparasitante',
      item,
      item.activo ? 'danger' : 'primary',
      item.activo ? 'Desactivar' : 'Activar'
    );
  }

  eliminarVacuna(id: number) {
    this.loadingStore.show();
    this.controlPreventivoService.eliminarTipoVacuna(id).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Vacuna eliminada' });
        this.loadVacunas(this.vacunasPage());
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo eliminar' });
        this.loadingStore.hide();
      }
    });
  }

  eliminarDesparasitante(id: number) {
    this.loadingStore.show();
    this.controlPreventivoService.eliminarTipoDesparasitante(id).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Desparasitante eliminado' });
        this.loadDesparasitantes(this.desparasitantesPage());
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo eliminar' });
        this.loadingStore.hide();
      }
    });
  }

  confirmarEliminarVacuna(item: any) {
    this.openConfirm(
      'Eliminar vacuna',
      '¿Está seguro de eliminar la vacuna «' + item.nombre + '»? Esta acción no se puede deshacer.',
      'eliminar-vacuna',
      item,
      'danger',
      'Eliminar'
    );
  }

  confirmarEliminarDesparasitante(item: any) {
    this.openConfirm(
      'Eliminar desparasitante',
      '¿Está seguro de eliminar el desparasitante «' + item.nombre + '»? Esta acción no se puede deshacer.',
      'eliminar-desparasitante',
      item,
      'danger',
      'Eliminar'
    );
  }

}
