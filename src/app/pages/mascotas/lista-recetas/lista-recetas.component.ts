import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { PaginatorModule } from 'primeng/paginator';
import { InputTextModule } from 'primeng/inputtext';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HistoriaClinicaService } from '../../../core/services/historia-clinica.service';
import { LoadingStore } from '../../../store/loading.store';
import { AuthStore } from '../../../store/auth.store';
import { PrescripcionResponse } from '../../../models/response/prescripcion-response';
import { Role } from '../../../core/enums/role.enum';

@Component({
  selector: 'app-lista-recetas',
  standalone: true,
  imports: [
    CommonModule,
    TableModule,
    ButtonModule,
    TooltipModule,
    PaginatorModule,
    InputTextModule,
    FormsModule
  ],
  templateUrl: './lista-recetas.component.html'
})
export class ListaRecetasComponent implements OnInit {
  private readonly hcService = inject(HistoriaClinicaService);
  private readonly router = inject(Router);
  readonly loadingStore = inject(LoadingStore);
  readonly authStore    = inject(AuthStore);

  recetas = signal<PrescripcionResponse[]>([]);
  totalRecords = signal(0);
  currentPage = 0;
  readonly pageSize = 10;
  searchQuery = '';
  mascotaId: number | null = null;
  numeroMicrochip = '';
  numeroDocumentoApoderado = '';
  numeroDocumentoEmpleado = '';
  numeroHc = '';
  fechaDesde = '';
  fechaHasta = '';

  ngOnInit() {
    this.cargarRecetas();
  }

  get activeCompanyId(): number | undefined {
    return this.authStore.selectedEnterprise()?.establishmentId ?? undefined;
  }

  cargarRecetas(page: number = 0) {
    this.currentPage = page;
    this.loadingStore.show();
    this.hcService.buscarRecetas({
      query: this.searchQuery,
      companyId: this.activeCompanyId,
      mascotaId: this.mascotaId ?? undefined,
      numeroMicrochip: this.numeroMicrochip || undefined,
      numeroDocumentoApoderado: this.numeroDocumentoApoderado || undefined,
      numeroDocumentoEmpleado: this.numeroDocumentoEmpleado || undefined,
      numeroHc: this.numeroHc || undefined,
      fechaDesde: this.fechaDesde || undefined,
      fechaHasta: this.fechaHasta || undefined
    }, page, this.pageSize).subscribe({
      next: (res) => {
        if (res.data) {
          this.recetas.set(res.data.content);
          this.totalRecords.set(res.data.totalElements);
        }
        this.loadingStore.hide();
      },
      error: () => this.loadingStore.hide()
    });
  }

  onFilterChange() {
    this.cargarRecetas(0);
  }

  onPageChange(event: any) {
    this.cargarRecetas(event.page);
  }

  resetFiltros() {
    this.searchQuery = '';
    this.mascotaId = null;
    this.numeroMicrochip = '';
    this.numeroDocumentoApoderado = '';
    this.numeroDocumentoEmpleado = '';
    this.numeroHc = '';
    this.fechaDesde = '';
    this.fechaHasta = '';
    this.cargarRecetas(0);
  }

  imprimirReceta(receta: PrescripcionResponse) {
  }

  abrirConsulta(receta: PrescripcionResponse) {
    if (!receta.consultaId) return;
    const roles = this.authStore.roles();
    const base = roles.includes(Role.ADMIN) || roles.includes(Role.SUPER_ADMIN)
      ? '/admin/historias-clinicas/consulta'
      : roles.includes(Role.VETERINARIO) || roles.includes(Role.RECEPCIONISTA)
        ? '/empleado/historias-clinicas/consulta'
        : '/historias-clinicas/consulta';
    this.router.navigate([base, receta.consultaId], { queryParams: { tab: 'recetas' } });
  }
}
