import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { PaginatorModule } from 'primeng/paginator';
import { ToastModule } from 'primeng/toast';
import { MenuModule } from 'primeng/menu';
import { MenuItem, MessageService } from 'primeng/api';

import { MascotaService } from '../../../core/services/mascota.service';
import { MediaService } from '../../../core/services/media.service';
import { CompanyService } from '../../../core/services/company.service';
import { HistoriaClinicaService } from '../../../core/services/historia-clinica.service';
import { MascotaResponse } from '../../../models/response/mascota-response';
import { LoadingStore } from '../../../store/loading.store';
import { AuthStore } from '../../../store/auth.store';
import { Role } from '../../../core/enums/role.enum';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';

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
    HasPermissionDirective
  ],
  providers: [MessageService],
  templateUrl: './lista-mascotas.component.html',
  styleUrl: './lista-mascotas.component.scss'
})
export class ListaMascotasComponent implements OnInit {
  private readonly mascotaService   = inject(MascotaService);
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
  totalRecords = signal<number>(0);
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

  readonly activoOpciones = [
    { label: 'Activos',   value: true  },
    { label: 'Inactivos', value: false },
  ];

  displayMotivoModal  = signal<boolean>(false);
  pendingDeactivation = signal<MascotaResponse | null>(null);

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

  mascotaActionItems(mascota: MascotaResponse): MenuItem[] {
    const items: MenuItem[] = [
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

  onFilterChange()  {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
    this.loadMascotas(0);
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
    if (event.key === 'Enter') this.loadMascotas(0);
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
