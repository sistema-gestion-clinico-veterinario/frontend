import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
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
import { MascotaResponse } from '../../../models/response/mascota-response';
import { MascotaRequest } from '../../../models/request/mascota-request';
import { LoadingStore } from '../../../store/loading.store';
import { AuthStore } from '../../../store/auth.store';
import { Role } from '../../../core/enums/role.enum';

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
    ToastModule
  ],
  providers: [MessageService],
  templateUrl: './lista-mascotas.component.html'
})
export class ListaMascotasComponent implements OnInit {
  private readonly fb               = inject(FormBuilder);
  private readonly mascotaService   = inject(MascotaService);
  private readonly apoderadoService = inject(ApoderadoService);
  private readonly companyService   = inject(CompanyService);
  private readonly messageService   = inject(MessageService);
  private readonly router           = inject(Router);
  readonly authStore                = inject(AuthStore);
  readonly loadingStore             = inject(LoadingStore);

  readonly isSuperAdmin = computed(() => this.authStore.roles().includes(Role.SUPER_ADMIN));

  // ── Data ──────────────────────────────────────────────────
  mascotas     = signal<MascotaResponse[]>([]);
  totalRecords = signal<number>(0);
  displayModal = signal<boolean>(false);
  isEdit       = signal<boolean>(false);
  editingId    = signal<number | null>(null);

  // ── Options ───────────────────────────────────────────────
  apoderados = signal<{ label: string; value: number }[]>([]);
  empresas   = signal<{ label: string; value: number }[]>([]);

  // ── Filtros ───────────────────────────────────────────────
  searchNombre      = '';
  filterEspecie: string | null   = null;
  filterActivo:  boolean | null  = null;
  selectedCompanyId: number | null = null;
  filtersOpen       = false;
  currentPage       = 0;
  readonly pageSize = 12;

  // ── Constantes ────────────────────────────────────────────
  readonly especieOpciones = [
    { label: 'Perro',   value: 'PERRO'   },
    { label: 'Gato',    value: 'GATO'    },
  ];

  readonly sexoOpciones = [
    { label: 'Macho',   value: 'MACHO'   },
    { label: 'Hembra',  value: 'HEMBRA'  },
  ];

  readonly activoOpciones = [
    { label: 'Activos',   value: true  },
    { label: 'Inactivos', value: false },
  ];

  // ── Formulario ────────────────────────────────────────────
  mascotaForm: FormGroup = this.fb.group({
    nombre:          ['',   [Validators.required]],
    especie:         [null, [Validators.required]],
    raza:            ['',   [Validators.required]],
    sexo:            [null, [Validators.required]],
    fechaNacimiento: ['',   [Validators.required]],
    color:           [''],
    peso:            [null],
    apoderadoId:     [null, [Validators.required]],
  });

  // ── Lifecycle ─────────────────────────────────────────────
  ngOnInit() {
    if (this.isSuperAdmin()) {
      this.loadEmpresas();
    } else {
      this.loadMascotas();
    }
    this.loadApoderados();
  }

  // ── Carga de datos ────────────────────────────────────────
  loadEmpresas() {
    this.companyService.listar(0, 100).subscribe({
      next: (res) => {
        this.empresas.set(
          res.data.content
            .filter(c => c.activo)
            .map(c => ({ label: c.name, value: c.id }))
        );
      }
    });
  }

  loadApoderados() {
    if (this.isSuperAdmin() && !this.selectedCompanyId) {
      this.apoderados.set([]);
      return;
    }

    const companyId = this.isSuperAdmin() ? (this.selectedCompanyId ?? undefined) : undefined;
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
    if (this.isSuperAdmin() && !this.selectedCompanyId) {
      this.mascotas.set([]);
      this.totalRecords.set(0);
      return;
    }

    this.currentPage = page;
    const companyId  = this.isSuperAdmin() ? (this.selectedCompanyId ?? undefined) : undefined;

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
        this.totalRecords.set(res.data.totalElements);
        this.loadingStore.hide();
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las mascotas' });
        this.loadingStore.hide();
      }
    });
  }

  // ── Eventos ───────────────────────────────────────────────
  onEmpresaChange() {
    this.loadMascotas(0);
    this.loadApoderados();
  }
  onFilterChange()  { this.loadMascotas(0); }
  onPageChange(e: any) { this.loadMascotas(e.page); }

  onSearch(event: KeyboardEvent) {
    if (event.key === 'Enter') this.loadMascotas(0);
  }

  // ── CRUD ──────────────────────────────────────────────────
  openNew() {
    this.isEdit.set(false);
    this.editingId.set(null);
    this.mascotaForm.reset();
    this.displayModal.set(true);
  }

  editMascota(mascota: MascotaResponse) {
    this.isEdit.set(true);
    this.editingId.set(mascota.id);
    this.mascotaForm.patchValue({
      nombre:          mascota.nombreCompleto,
      especie:         mascota.especie,
      raza:            mascota.raza,
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
      nombre:          v.nombre,
      especie:         v.especie,
      raza:            v.raza,
      sexo:            v.sexo,
      fechaNacimiento: v.fechaNacimiento,
      color:           v.color || undefined,
      peso:            v.peso  || undefined,
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
    this.mascotaService.cambiarEstado(mascota.id, nuevoEstado).subscribe({
      next: () => {
        this.loadMascotas(this.currentPage);
        this.messageService.add({
          severity: 'success',
          summary: 'Estado actualizado',
          detail: `Mascota ${nuevoEstado ? 'activada' : 'desactivada'}`
        });
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cambiar el estado' });
      }
    });
  }

  verHistoriaClinica(mascota: MascotaResponse) {
    this.router.navigate(['/historias-clinicas/mascota', mascota.id]);
  }

  // ── Helpers de presentación ───────────────────────────────
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
