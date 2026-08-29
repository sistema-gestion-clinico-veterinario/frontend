import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { PaginatorModule } from 'primeng/paginator';
import { SkeletonModule } from 'primeng/skeleton';
import { HistoriaClinicaService } from '../../../core/services/historia-clinica.service';
import { LoadingStore } from '../../../store/loading.store';
import { AuthStore } from '../../../store/auth.store';
import { FormsModule } from '@angular/forms';
import { HistoriaClinicaResumen } from '../../../models/response/historia-clinica-response';

@Component({
  selector: 'app-lista-hc',
  standalone: true,
  imports: [CommonModule, TableModule, ButtonModule, TagModule, FormsModule, PaginatorModule, SkeletonModule],
  templateUrl: './lista-hc.component.html'
})
export class ListaHcComponent implements OnInit {
  private readonly hcService    = inject(HistoriaClinicaService);
  readonly loadingStore         = inject(LoadingStore);
  readonly authStore            = inject(AuthStore);
  private readonly router       = inject(Router);

  cargando = signal(true);

  historias    = signal<HistoriaClinicaResumen[]>([]);
  totalRecords = signal(0);
  currentPage  = 0;
  readonly pageSize = 10;

  searchNumeroHc       = '';
  searchNombrePaciente = '';
  searchPropietario    = '';
  searchFechaDesde     = '';
  searchFechaHasta     = '';
  filterError           = signal<string | null>(null);

  ngOnInit() {
    this.cargarHistorias();
  }

  get activeCompanyId(): number | undefined {
    return this.authStore.selectedEnterprise()?.establishmentId ?? undefined;
  }

  get isGlobalSuperAdminMode(): boolean {
    return this.authStore.isSuperAdmin() && !this.activeCompanyId;
  }

  /*get contextLabel(): string {
    if (this.isGlobalSuperAdminMode) return 'Vista global · Todas las empresas';
    const companyName = this.authStore.selectedEnterprise()?.name ?? this.authStore.companyName();
    return companyName ? `Empresa seleccionada · ${companyName}` : '';
  }*/

  cargarHistorias(page: number = 0) {
    if (!this.validarFiltros()) return;
    const dateRange = this.resolveDateRange();

    this.currentPage = page;
    this.cargando.set(true);
    this.loadingStore.show();
    this.hcService.buscar({
      numeroHc:          this.searchNumeroHc       || undefined,
      nombrePaciente:    this.searchNombrePaciente || undefined,
      nombrePropietario: this.searchPropietario    || undefined,
      fechaDesde:        dateRange.fechaDesde,
      fechaHasta:        dateRange.fechaHasta,
      companyId:         this.activeCompanyId,
      page,
      size: this.pageSize
    }).subscribe({
      next: (res) => {
        this.historias.set(res.data.content);
        this.totalRecords.set(res.data?.page?.totalElements ?? res.data?.totalElements ?? 0);
        this.cargando.set(false);
        this.loadingStore.hide();
      },
      error: () => { this.cargando.set(false); this.loadingStore.hide(); }
    });
  }

  onFilterChange() { this.cargarHistorias(0); }
  onPageChange(e: any) { this.cargarHistorias(e.page); }

  onNumeroHcInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const sanitized = this.sanitizeNumeroHc(input.value);

    if (input.value !== sanitized) {
      input.value = sanitized;
    }

    this.searchNumeroHc = sanitized;
    this.filterError.set(null);
  }

  resetFiltros() {
    this.searchNumeroHc       = '';
    this.searchNombrePaciente = '';
    this.searchPropietario    = '';
    this.searchFechaDesde     = '';
    this.searchFechaHasta     = '';
    this.filterError.set(null);
    this.cargarHistorias(0);
  }

  verDetalle(numeroHc: string) {
    this.router.navigate(['/historias-clinicas/mascota', numeroHc], { queryParams: { returnUrl: '/historias-clinicas' } });
  }

  private validarFiltros(): boolean {
    this.searchNumeroHc = this.searchNumeroHc.trim().toUpperCase();
    this.searchNombrePaciente = this.searchNombrePaciente.trim();
    this.searchPropietario = this.searchPropietario.trim();
    this.filterError.set(null);

    if (this.searchNumeroHc && !/^HC-\d{6}$/.test(this.searchNumeroHc)) {
      this.filterError.set('El codigo HC debe tener el formato HC-000001.');
      return false;
    }

    if (!this.esNombreBusquedaValido(this.searchNombrePaciente)) {
      this.filterError.set('Ingrese un nombre de paciente válido, sin exceso de símbolos.');
      return false;
    }

    if (!this.esNombreBusquedaValido(this.searchPropietario)) {
      this.filterError.set('Ingrese un nombre de propietario válido, sin exceso de símbolos.');
      return false;
    }

    if (!this.esFechaBusquedaValida(this.searchFechaDesde)) {
      this.filterError.set('Ingrese una fecha desde valida con anio completo.');
      return false;
    }

    if (!this.esFechaBusquedaValida(this.searchFechaHasta)) {
      this.filterError.set('Ingrese una fecha hasta valida con anio completo.');
      return false;
    }

    if (this.searchFechaDesde && this.searchFechaHasta && this.searchFechaDesde > this.searchFechaHasta) {
      this.filterError.set('La fecha desde no puede ser mayor que la fecha hasta.');
      return false;
    }

    return true;
  }

  private resolveDateRange(): { fechaDesde?: string; fechaHasta?: string } {
    const fechaDesde = this.searchFechaDesde || '';
    const fechaHasta = this.searchFechaHasta || '';

    if (fechaDesde && !fechaHasta) {
      return { fechaDesde, fechaHasta: fechaDesde };
    }

    if (!fechaDesde && fechaHasta) {
      return { fechaDesde: fechaHasta, fechaHasta };
    }

    return {
      fechaDesde: fechaDesde || undefined,
      fechaHasta: fechaHasta || undefined
    };
  }

  private esNombreBusquedaValido(value: string): boolean {
    if (!value) return true;
    if (value.length > 80) return false;
    if (!/\p{L}/u.test(value)) return false;
    if (/^[\p{P}\p{S}\s]+$/u.test(value)) return false;
    if (/[\p{P}\p{S}]{6,}/u.test(value)) return false;
    if (/[{}\[\]<>*|\\^~`=@]/.test(value)) return false;
    if (/<\s*\/?\s*(script|iframe|object|embed|style|img|svg|body|html|link|meta)\b|javascript:|data:text\/html|on\w+\s*=/i.test(value)) return false;
    return /^[\p{L}\p{M}\s.'-]+$/u.test(value);
  }

  private sanitizeNumeroHc(value: string): string {
    return (value ?? '')
      .toUpperCase()
      .replace(/[^HC0-9-]/g, '')
      .slice(0, 9);
  }

  private esFechaBusquedaValida(value: string): boolean {
    if (!value) return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

    const [year, month, day] = value.split('-').map(Number);
    if (year < 1900) return false;

    const date = new Date(year, month - 1, day);
    const isRealDate = date.getFullYear() === year
      && date.getMonth() === month - 1
      && date.getDate() === day;
    if (!isRealDate) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date <= today;
  }
}
