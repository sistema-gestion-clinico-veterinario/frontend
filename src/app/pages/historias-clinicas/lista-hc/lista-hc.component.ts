import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { PaginatorModule } from 'primeng/paginator';
import { HistoriaClinicaService } from '../../../core/services/historia-clinica.service';
import { LoadingStore } from '../../../store/loading.store';
import { AuthStore } from '../../../store/auth.store';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-lista-hc',
  standalone: true,
  imports: [CommonModule, TableModule, ButtonModule, TagModule, FormsModule, PaginatorModule],
  templateUrl: './lista-hc.component.html'
})
export class ListaHcComponent implements OnInit {
  private readonly hcService    = inject(HistoriaClinicaService);
  readonly loadingStore         = inject(LoadingStore);
  readonly authStore            = inject(AuthStore);
  private readonly router       = inject(Router);

  historias    = signal<any[]>([]);
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

  cargarHistorias(page: number = 0) {
    if (!this.validarFiltros()) return;
    this.currentPage = page;
    this.loadingStore.show();
    this.hcService.buscar({
      numeroHc:          this.searchNumeroHc       || undefined,
      nombrePaciente:    this.searchNombrePaciente || undefined,
      nombrePropietario: this.searchPropietario    || undefined,
      fechaDesde:        this.searchFechaDesde     || undefined,
      fechaHasta:        this.searchFechaHasta     || undefined,
      companyId:         this.activeCompanyId,
      page,
      size: this.pageSize
    }).subscribe({
      next: (res) => {
        this.historias.set(res.data.content);
        this.totalRecords.set(res.data?.page?.totalElements ?? res.data?.totalElements ?? 0);
        this.loadingStore.hide();
      },
      error: () => this.loadingStore.hide()
    });
  }

  onFilterChange() { this.cargarHistorias(0); }
  onPageChange(e: any) { this.cargarHistorias(e.page); }

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

    if (this.searchNumeroHc && !/^HC-\d{1,6}$/.test(this.searchNumeroHc)) {
      this.filterError.set('El código HC debe tener el formato HC-000001.');
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

    if (this.searchFechaDesde && this.searchFechaHasta && this.searchFechaDesde > this.searchFechaHasta) {
      this.filterError.set('La fecha desde no puede ser mayor que la fecha hasta.');
      return false;
    }

    return true;
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
}
