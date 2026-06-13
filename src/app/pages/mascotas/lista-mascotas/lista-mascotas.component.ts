import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { PaginatorModule } from 'primeng/paginator';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { MascotaService } from '../../../core/services/mascota.service';
import { ApoderadoService } from '../../../core/services/apoderado.service';
import { CompanyService } from '../../../core/services/company.service';
import { RazaService } from '../../../core/services/raza.service';
import { MascotaResponse } from '../../../models/response/mascota-response';
import { MascotaRequest } from '../../../models/request/mascota-request';
import { RazaResponse } from '../../../models/response/raza-response';
import { RazaRequest } from '../../../models/request/raza-request';
import { LoadingStore } from '../../../store/loading.store';
import { AuthStore } from '../../../store/auth.store';
import { Role } from '../../../core/enums/role.enum';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';

@Component({
  selector: 'app-lista-mascotas',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule,
    ButtonModule,
    DialogModule,
    DropdownModule,
    InputTextModule,
    PaginatorModule,
    ToastModule,
    HasPermissionDirective
  ],
  providers: [MessageService],
  templateUrl: './lista-mascotas.component.html'
})
export class ListaMascotasComponent implements OnInit {
  private readonly fb               = inject(FormBuilder);
  private readonly mascotaService   = inject(MascotaService);
  private readonly apoderadoService = inject(ApoderadoService);
  private readonly razaService      = inject(RazaService);
  private readonly companyService   = inject(CompanyService);
  private readonly messageService   = inject(MessageService);
  private readonly router           = inject(Router);
  readonly authStore                = inject(AuthStore);
  readonly loadingStore             = inject(LoadingStore);

  readonly isSuperAdmin = computed(() => this.authStore.roles().includes(Role.SUPER_ADMIN));

  readonly todayStr = new Date().toISOString().split('T')[0];

  mascotas     = signal<MascotaResponse[]>([]);
  totalRecords = signal<number>(0);
  displayModal = signal<boolean>(false);
  isEdit       = signal<boolean>(false);
  editingId    = signal<number | null>(null);
  apoderados = signal<{ label: string; value: number }[]>([]);
  razas = signal<{ label: string; value: number }[]>([]);
  razaFilterText = signal<string>('');
  razaDropdownOpen = signal<boolean>(false);
  displayRazaModal = signal<boolean>(false);
  savingRaza = signal<boolean>(false);
  searchNombre      = '';
  filterEspecie: string | null   = null;
  filterActivo:  boolean | null  = null;
  filtersOpen       = false;
  currentPage       = 0;
  readonly pageSize = 12;
  readonly especieOpciones = [
    { label: 'Perro',  value: 'PERRO'  },
    { label: 'Gato',   value: 'GATO'   },
    { label: 'Roedor', value: 'ROEDOR' },
    { label: 'Ave',    value: 'AVE'    },
    { label: 'Reptil', value: 'REPTIL' },
    { label: 'Otro',   value: 'OTRO'   },
  ];

  readonly sexoOpciones = [
    { label: 'Macho',   value: 'MACHO'   },
    { label: 'Hembra',  value: 'HEMBRA'  },
  ];

  readonly activoOpciones = [
    { label: 'Activos',   value: true  },
    { label: 'Inactivos', value: false },
  ];

  mascotaForm: FormGroup = this.fb.group({
    nombre:          ['',   [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    especie:         [null, [Validators.required]],
    razaId:          [null, [Validators.required]],
    sexo:            [null, [Validators.required]],
    fechaNacimiento: ['',   [Validators.required, (control: AbstractControl) => this.fechaNoFuturaValidator(control)]],
    color:           ['', [Validators.maxLength(50)]],
    peso:            [null, [Validators.min(0.01), Validators.max(120)]],
    apoderadoId:     [null, [Validators.required]],
  });

  razaForm: FormGroup = this.fb.group({
    nombre:      ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    descripcion: ['', [Validators.maxLength(300)]],
  });
  displayMotivoModal  = signal<boolean>(false);
  pendingDeactivation = signal<MascotaResponse | null>(null);

  readonly motivoBajaOpciones = [
    { label: 'Fallecimiento',        value: 'FALLECIMIENTO' },
    { label: 'Deja de asistir',      value: 'DEJA_ASISTIR' },
    { label: 'Cambio de propietario',value: 'CAMBIO_PROPIETARIO' },
    { label: 'Otro',                 value: 'OTRO' }
  ];

  motivoForm: FormGroup = this.fb.group({
    motivoBaja: [null, [Validators.required]],
    otroMotivo: ['']
  });

  get activeCompanyId(): number | null {
    return this.authStore.selectedEnterprise()?.establishmentId ?? this.authStore.companyId();
  }

  ngOnInit() {
    this.loadMascotas();
    this.loadApoderados();
    this.loadRazas();
    this.mascotaForm.get('especie')?.valueChanges.subscribe(() => {
      this.actualizarValidadoresPeso();
      this.loadRazas();
      this.mascotaForm.get('razaId')?.setValue(null);
    });
  }

  fechaNoFuturaValidator(control: AbstractControl): ValidationErrors | null {
    return control.value && control.value > this.todayStr ? { fechaFutura: true } : null;
  }

  private actualizarValidadoresPeso() {
    const pesoCtrl = this.mascotaForm.get('peso');
    const especie = this.mascotaForm.get('especie')?.value;
    const rangos: Record<string, { min: number; max: number }> = {
      PERRO: { min: 0.5, max: 120 },
      GATO: { min: 0.3, max: 20 },
      AVE: { min: 0.02, max: 5 },
      REPTIL: { min: 0.01, max: 100 },
      ROEDOR: { min: 0.02, max: 10 },
      EXOTICO: { min: 0.01, max: 120 },
      OTRO: { min: 0.01, max: 120 }
    };
    const rango = rangos[especie] ?? rangos['OTRO'];
    pesoCtrl?.setValidators([Validators.min(rango.min), Validators.max(rango.max)]);
    pesoCtrl?.updateValueAndValidity({ emitEvent: false });
  }

  get razasFiltradas() {
    const filtro = this.razaFilterText().toLowerCase();
    return this.razas().filter(r => r.label.toLowerCase().includes(filtro));
  }

  loadRazas() {
    const especie = this.mascotaForm.get('especie')?.value;
    this.razaService.listarPorEspecie(especie || undefined).subscribe({
      next: (res) => {
        this.razas.set(res.data.map(r => ({ label: r.nombre, value: r.id })));
      }
    });
  }

  openRazaModal() {
    this.razaForm.reset({ nombre: '', descripcion: '' });
    this.displayRazaModal.set(true);
  }

  saveRaza() {
    if (this.razaForm.invalid) {
      this.razaForm.markAllAsTouched();
      return;
    }
    const especie = this.mascotaForm.get('especie')?.value;
    if (!especie) {
      this.messageService.add({ severity: 'warn', summary: 'Atención', detail: 'Primero seleccione una especie' });
      return;
    }
    const request: RazaRequest = {
      nombre: this.razaForm.value.nombre,
      descripcion: this.razaForm.value.descripcion || undefined,
      especie
    };
    this.savingRaza.set(true);
    this.razaService.crear(request).subscribe({
      next: (res) => {
        this.messageService.add({ severity: 'success', summary: 'Listo', detail: 'Raza creada correctamente' });
        this.displayRazaModal.set(false);
        this.loadRazas();
        this.mascotaForm.get('razaId')?.setValue(res.data.id);
        this.savingRaza.set(false);
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al crear la raza' });
        this.savingRaza.set(false);
      }
    });
  }

  loadApoderados() {
    const companyId = this.activeCompanyId;
    if (!companyId) {
      this.apoderados.set([]);
      return;
    }
    this.apoderadoService.listar(companyId, undefined, undefined, 0, 200).subscribe({
      next: (res) => {
        this.apoderados.set(
          res.data.content.map(c => ({
            label: `${c.nombre} ${c.apellido}`,
            value: c.id
          }))
        );
      }
    });
  }

  loadMascotas(page: number = 0) {
    const companyId = this.activeCompanyId;
    if (!companyId) {
      this.mascotas.set([]);
      this.totalRecords.set(0);
      return;
    }

    this.currentPage = page;

    this.loadingStore.show();
    this.mascotaService.listar(
      companyId,
      this.searchNombre  || undefined,
      this.filterEspecie || undefined,
      page,
      this.pageSize,
      this.filterActivo  ?? undefined
    ).subscribe({
      next: (res) => {
        this.mascotas.set(res.data.content);
        this.totalRecords.set(res.data?.page?.totalElements ?? res.data?.totalElements ?? 0);
        this.loadingStore.hide();
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las mascotas' });
        this.loadingStore.hide();
      }
    });
  }

  onFilterChange()  { this.loadMascotas(0); }
  onPageChange(e: any) { this.loadMascotas(e.page); }

  onSearch(event: KeyboardEvent) {
    if (event.key === 'Enter') this.loadMascotas(0);
  }

  openNew() {
    this.isEdit.set(false);
    this.editingId.set(null);
    this.mascotaForm.reset();
    this.displayModal.set(true);
  }

  editMascota(mascota: MascotaResponse) {
    this.isEdit.set(true);
    this.editingId.set(mascota.id);
    this.loadRazas();
    this.mascotaForm.patchValue({
      nombre:          mascota.nombreCompleto,
      especie:         mascota.especie,
      razaId:          mascota.razaId,
      sexo:            mascota.sexo,
      fechaNacimiento: mascota.fechaNacimiento,
      color:           mascota.color ?? '',
      peso:            mascota.peso ?? null,
      apoderadoId:     mascota.apoderadoId,
    });
    this.displayModal.set(true);
  }

  saveMascota() {
    if (this.mascotaForm.invalid) {
      this.mascotaForm.markAllAsTouched();
      return;
    }
    const v = this.mascotaForm.value;
    const request: MascotaRequest = {
      nombreCompleto:  v.nombre,
      especie:         v.especie,
      razaId:          v.razaId,
      sexo:            v.sexo,
      fechaNacimiento: v.fechaNacimiento,
      color:           v.color || undefined,
      peso:            v.peso ?? undefined,
      apoderadoId:     v.apoderadoId,
    };

    this.loadingStore.show();
    const obs = this.isEdit()
      ? this.mascotaService.actualizar(this.editingId()!, request)
      : this.mascotaService.crear(request);

    obs.subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Listo',
          detail: this.isEdit() ? 'Mascota actualizada correctamente' : 'Mascota registrada correctamente'
        });
        this.displayModal.set(false);
        this.loadMascotas(this.currentPage);
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err.error?.message || 'Error al guardar la mascota'
        });
        this.loadingStore.hide();
      }
    });
  }

  toggleEstado(mascota: MascotaResponse) {
    const nuevoEstado = !mascota.activo;
    
    if (!nuevoEstado) {
      this.pendingDeactivation.set(mascota);
      this.motivoForm.reset();
      this.displayMotivoModal.set(true);
      return;
    }

    this.executeCambiarEstado(mascota, true);
  }

  confirmDeactivation() {
    if (this.motivoForm.invalid) {
      this.motivoForm.markAllAsTouched();
      return;
    }
    const mascota = this.pendingDeactivation();
    if (!mascota) return;

    const val = this.motivoForm.value;
    if (val.motivoBaja === 'OTRO' && !val.otroMotivo?.trim()) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Debe especificar el motivo' });
      return;
    }

    this.displayMotivoModal.set(false);
    this.executeCambiarEstado(mascota, false, val.motivoBaja, val.otroMotivo?.trim() || undefined);
  }

  private executeCambiarEstado(mascota: MascotaResponse, nuevoEstado: boolean, motivoBaja?: string, otroMotivo?: string) {
    this.loadingStore.show();
    this.mascotaService.cambiarEstado(mascota.id, nuevoEstado, motivoBaja, otroMotivo).subscribe({
      next: () => {
        this.loadMascotas(this.currentPage);
        this.messageService.add({
          severity: 'success',
          summary: 'Estado actualizado',
          detail: `Mascota ${nuevoEstado ? 'activada' : 'desactivada'}`
        });
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo cambiar el estado' });
        this.loadingStore.hide();
      }
    });
  }

  verHistoriaClinica(mascota: MascotaResponse) {
    this.router.navigate(['/historias-clinicas/mascota', mascota.id], { queryParams: { returnUrl: '/mascotas' } });
  }

  calcularEdad(fechaNacimiento: string): string {
    if (!fechaNacimiento) return '—';
    const hoy  = new Date();
    const nac  = new Date(fechaNacimiento);
    let años   = hoy.getFullYear() - nac.getFullYear();
    let meses  = hoy.getMonth() - nac.getMonth();
    if (meses < 0 || (meses === 0 && hoy.getDate() < nac.getDate())) {
      años--;
      meses += 12;
    }
    if (años  > 0) return `${años} año${años > 1   ? 's' : ''}`;
    if (meses > 0) return `${meses} mes${meses > 1 ? 'es' : ''}`;
    return '< 1 mes';
  }

  especieLabel(especie: string): string {
    const m: Record<string, string> = {
      PERRO: 'Perro', GATO: 'Gato', AVE: 'Ave',
      CONEJO: 'Conejo', REPTIL: 'Reptil', OTRO: 'Otro'
    };
    return m[especie?.toUpperCase()] ?? especie;
  }

  especieBadgeClass(especie: string): string {
    switch (especie?.toUpperCase()) {
      case 'PERRO':  return 'bg-blue-50 text-blue-700';
      case 'GATO':   return 'bg-violet-50 text-violet-700';
      case 'AVE':    return 'bg-amber-50 text-amber-700';
      case 'CONEJO': return 'bg-green-50 text-green-700';
      case 'REPTIL': return 'bg-teal-50 text-teal-700';
      default:       return 'bg-slate-100 text-slate-500';
    }
  }

  especieAvatarClass(especie: string): string {
    switch (especie?.toUpperCase()) {
      case 'PERRO':  return 'bg-blue-100 text-blue-700';
      case 'GATO':   return 'bg-violet-100 text-violet-700';
      case 'AVE':    return 'bg-amber-100 text-amber-700';
      case 'CONEJO': return 'bg-green-100 text-green-700';
      case 'REPTIL': return 'bg-teal-100 text-teal-700';
      default:       return 'bg-slate-100 text-slate-500';
    }
  }

  sexoLabel(sexo: string): string {
    return sexo === 'MACHO' ? 'Macho' : 'Hembra';
  }
}
