import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { PaginatorModule } from 'primeng/paginator';
import { InputTextModule } from 'primeng/inputtext';
import { FormsModule } from '@angular/forms';
import { HistoriaClinicaService } from '../../../core/services/historia-clinica.service';
import { LoadingStore } from '../../../store/loading.store';
import { AuthStore } from '../../../store/auth.store';
import { PrescripcionResponse } from '../../../models/response/prescripcion-response';

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
  readonly loadingStore = inject(LoadingStore);
  readonly authStore    = inject(AuthStore);

  recetas = signal<PrescripcionResponse[]>([]);
  totalRecords = signal(0);
  currentPage = 0;
  readonly pageSize = 10;
  searchQuery = '';

  ngOnInit() {
    this.cargarRecetas();
  }

  get activeCompanyId(): number | undefined {
    return this.authStore.selectedEnterprise()?.establishmentId ?? undefined;
  }

  cargarRecetas(page: number = 0) {
    this.currentPage = page;
    this.loadingStore.show();
    this.hcService.buscarRecetas(this.searchQuery, page, this.pageSize, this.activeCompanyId).subscribe({
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
    this.cargarRecetas(0);
  }

  imprimirReceta(receta: PrescripcionResponse) {
  }
}
