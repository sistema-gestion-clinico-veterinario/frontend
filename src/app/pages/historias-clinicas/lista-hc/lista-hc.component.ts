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

  ngOnInit() {
    this.cargarHistorias();
  }

  get activeCompanyId(): number | undefined {
    return this.authStore.selectedEnterprise()?.establishmentId ?? undefined;
  }

  cargarHistorias(page: number = 0) {
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
        this.totalRecords.set(res.data.totalElements);
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
    this.cargarHistorias(0);
  }

  verDetalle(mascotaId: number) {
    this.router.navigate(['/historias-clinicas/mascota', mascotaId]);
  }
}
