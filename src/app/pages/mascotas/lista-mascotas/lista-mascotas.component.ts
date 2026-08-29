import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { PaginatorModule } from 'primeng/paginator';
import { ToastModule } from 'primeng/toast';
import { MenuModule } from 'primeng/menu';
import { SkeletonModule } from 'primeng/skeleton';
import { MenuItem, MessageService } from 'primeng/api';
import { forkJoin } from 'rxjs';

import { MascotaService } from '../../../core/services/mascota.service';
import { ApoderadoService } from '../../../core/services/apoderado.service';
import { MediaService } from '../../../core/services/media.service';
import { CompanyService } from '../../../core/services/company.service';
import { HistoriaClinicaService } from '../../../core/services/historia-clinica.service';
import { MascotaResponse } from '../../../models/response/mascota-response';
import { ApoderadoRequest } from '../../../models/request/apoderado-request';
import { LoadingStore } from '../../../store/loading.store';
import { AuthStore } from '../../../store/auth.store';
import { Role } from '../../../core/enums/role.enum';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { InputFilterDirective } from '../../../core/directives/input-filter.directive';

@Component({
  selector: 'app-lista-mascotas',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    ButtonModule,
    DropdownModule,
    PaginatorModule,
    ToastModule,
    MenuModule,
    SkeletonModule,
    HasPermissionDirective,
    InputFilterDirective
  ],
  providers: [MessageService],
  templateUrl: './lista-mascotas.component.html',
  styleUrl: './lista-mascotas.component.scss'
})
export class ListaMascotasComponent implements OnInit {
  private readonly mascotaActionItemsCache = new WeakMap<MascotaResponse, MenuItem[]>();
  private readonly mascotaService   = inject(MascotaService);
  private readonly apoderadoService = inject(ApoderadoService);
  readonly mediaService     = inject(MediaService);
  private readonly companyService   = inject(CompanyService);
  private readonly messageService   = inject(MessageService);
  private readonly hcService        = inject(HistoriaClinicaService);
  private readonly router           = inject(Router);
  private readonly route            = inject(ActivatedRoute);
  readonly authStore                = inject(AuthStore);
  readonly loadingStore             = inject(LoadingStore);

  readonly isSuperAdmin = computed(() => this.authStore.roles().includes(Role.SUPER_ADMIN));

  mascotas     = signal<MascotaResponse[]>([]);
  cargando     = signal<boolean>(true);
  totalRecords = signal<number>(0);
  searchNombre      = '';
  filterEspecie: string | null   = null;
  filterActivo:  boolean | null  = null;
  filtersOpen       = false;
  currentPage       = 0;
  readonly pageSize = 12;
  private readonly nameFilterPattern = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü]+(?: [A-Za-zÁÉÍÓÚáéíóúÑñÜü]+)*$/;

  readonly especieOpciones = [
    { label: 'Perro',  value: 'PERRO'  },
    { label: 'Gato',   value: 'GATO'   },
    { label: 'Roedor', value: 'ROEDOR' },
    { label: 'Ave',    value: 'AVE'    },
    { label: 'Reptil', value: 'REPTIL' },
    { label: 'Otro',   value: 'OTRO'   },
  ];

  readonly activoOpciones = [
    { label: 'Activos',   value: true  },
    { label: 'Inactivos', value: false },
  ];

  displayMotivoModal  = signal<boolean>(false);
  pendingDeactivation = signal<MascotaResponse | null>(null);
  displayDetailModal = signal<boolean>(false);
  selectedPetDetail = signal<MascotaResponse | null>(null);
  selectedOwnerDetail = signal<ApoderadoRequest | null>(null);

  readonly motivoBajaOpciones = [
    { label: 'Fallecimiento',        value: 'FALLECIMIENTO' },
    { label: 'Deja de asistir',      value: 'DEJA_ASISTIR' },
    { label: 'Cambio de propietario',value: 'CAMBIO_PROPIETARIO' },
    { label: 'Otro',                 value: 'OTRO' }
  ];

  motivoBaja = signal<string | null>(null);
  otroMotivo = signal<string>('');

  canMascotaModify(): boolean {
    return this.authStore.isSuperAdmin() || this.authStore.hasAccess('VISTA_MASCOTAS', 'modificar');
  }

  viewPetDetail(mascota: MascotaResponse) {
    this.loadingStore.show();
    forkJoin({
      pet: this.mascotaService.obtenerPorId(mascota.id),
      owner: this.apoderadoService.getById(mascota.apoderadoId)
    }).subscribe({
      next: (res) => {
        this.selectedPetDetail.set(res.pet.data);
        this.selectedOwnerDetail.set(res.owner.data);
        this.displayDetailModal.set(true);
        this.loadingStore.hide();
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar la información de la mascota' });
        this.loadingStore.hide();
      }
    });
  }

  mascotaActionItems(mascota: MascotaResponse): MenuItem[] {
    const cached = this.mascotaActionItemsCache.get(mascota);
    if (cached) return cached;

    const items: MenuItem[] = [
      {
        label: 'Ver Detalles',
        icon: 'pi pi-eye',
        command: () => this.viewPetDetail(mascota)
      },
      {
        label: 'Ver historia clínica',
        icon: 'pi pi-file-edit',
        command: () => this.verHistoriaClinica(mascota)
      }
    ];

    if (this.canMascotaModify()) {
      items.unshift({
        label: 'Editar',
        icon: 'pi pi-pencil',
        disabled: !mascota.activo,
        command: () => this.irAEditar(mascota)
      });
      items.push({
        label: mascota.activo ? 'Desactivar' : 'Activar',
        icon: mascota.activo ? 'pi pi-ban' : 'pi pi-check-circle',
        command: () => this.toggleEstado(mascota)
      });
    }

    this.mascotaActionItemsCache.set(mascota, items);
    return items;
  }

  get activeCompanyId(): number | null {
    return this.authStore.selectedEnterprise()?.establishmentId ?? this.authStore.companyId();
  }

  ngOnInit() {
    const page = Number(this.route.snapshot.queryParamMap.get('page'));
    this.loadMascotas(Number.isInteger(page) && page > 0 ? page : 0);
  }

  loadMascotas(page: number = 0) {
    const companyId = this.activeCompanyId;
    if (!companyId) {
      this.mascotas.set([]);
      this.totalRecords.set(0);
      return;
    }

    this.cargando.set(true);
    this.currentPage = page;
    const nombre = this.normalizeNameFilter(this.searchNombre);
    this.searchNombre = nombre;

    this.mascotaService.listar(
      companyId,
      nombre || undefined,
      this.filterEspecie || undefined,
      page,
      this.pageSize,
      this.filterActivo  ?? undefined
    ).subscribe({
      next: (res) => {
        this.mascotas.set(res.data.content);
        this.totalRecords.set(res.data?.page?.totalElements ?? res.data?.totalElements ?? 0);
        this.cargando.set(false);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las mascotas' });
        this.cargando.set(false);
      }
    });
  }

  onFilterChange()  {
    if (!this.normalizeAndValidateFilters()) return;

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
    this.loadMascotas(0);
  }

  clearFilters() {
    this.searchNombre = '';
    this.filterEspecie = null;
    this.filterActivo = null;
    this.onFilterChange();
  }

  onPetNameFilterInput(value: string) {
    const hadFilter = !!this.searchNombre.trim();
    this.searchNombre = this.sanitizeNameFilter(value);

    if (hadFilter && !this.searchNombre.trim() && !this.filterEspecie && this.filterActivo === null) {
      this.onFilterChange();
    }
  }

  onPageChange(e: any) {
    const page = Number(e.page) || 0;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: page > 0 ? page : null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
    this.loadMascotas(page);
  }

  onSearch(event: KeyboardEvent) {
    if (event.key === 'Enter') this.onFilterChange();
  }

  private normalizeAndValidateFilters(): boolean {
    const nombre = this.normalizeNameFilter(this.searchNombre);
    this.searchNombre = nombre;

    if (nombre && !this.nameFilterPattern.test(nombre)) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Filtro inválido',
        detail: 'El nombre de la mascota solo debe contener letras y espacios entre palabras.'
      });
      return false;
    }

    return true;
  }

  private sanitizeNameFilter(value: string): string {
    return (value ?? '')
      .replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]/g, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/^\s+/, '')
      .slice(0, 80);
  }

  private normalizeNameFilter(value: string): string {
    return this.sanitizeNameFilter(value).trim().replace(/\s+/g, ' ');
  }

  irANueva() {
    this.router.navigate(['/mascotas/form']);
  }

  irAEditar(mascota: MascotaResponse) {
    this.router.navigate(['/mascotas/form', mascota.uuid], {
      queryParams: { returnPage: this.currentPage > 0 ? this.currentPage : null },
      state: mascota
    });
  }

  toggleEstado(mascota: MascotaResponse) {
    const nuevoEstado = !mascota.activo;
    
    if (!nuevoEstado) {
      this.pendingDeactivation.set(mascota);
      this.motivoBaja.set(null);
      this.otroMotivo.set('');
      this.displayMotivoModal.set(true);
      return;
    }

    this.executeCambiarEstado(mascota, true);
  }

  confirmDeactivation() {
    const val = this.motivoBaja();
    if (!val) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Debe seleccionar un motivo' });
      return;
    }
    const mascota = this.pendingDeactivation();
    if (!mascota) return;

    if (val === 'OTRO' && !this.otroMotivo()?.trim()) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Debe especificar el motivo' });
      return;
    }

    this.displayMotivoModal.set(false);
    this.executeCambiarEstado(mascota, false, val, this.otroMotivo()?.trim() || undefined);
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
    this.hcService.getPorMascota(mascota.id).subscribe({
      next: (res) => this.router.navigate(['/historias-clinicas/mascota', res.data.numeroHc], { queryParams: { returnUrl: '/mascotas' } }),
      error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se encontró la historia clínica de esta mascota.' })
    });
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
