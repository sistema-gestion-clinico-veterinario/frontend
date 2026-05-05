import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { HistoriaClinicaService } from '../../../core/services/historia-clinica.service';
import { LoadingStore } from '../../../store/loading.store';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-lista-hc',
  standalone: true,
  imports: [CommonModule, TableModule, InputTextModule, ButtonModule, TagModule, FormsModule],
  templateUrl: './lista-hc.component.html'
})
export class ListaHcComponent {
  private readonly hcService    = inject(HistoriaClinicaService);
  private readonly loadingStore = inject(LoadingStore);
  private readonly router       = inject(Router);

  historias = signal<any[]>([]);
  totalRecords = signal(0);
  
  filters = {
    numeroHc: '',
    nombrePaciente: '',
    nombrePropietario: ''
  };

  ngOnInit() {
    this.cargarHistorias();
  }

  cargarHistorias(event?: any) {
    const page = event ? event.first / event.rows : 0;
    const size = event ? event.rows : 10;

    this.loadingStore.show();
    this.hcService.buscar({ ...this.filters, page, size }).subscribe({
      next: (res) => {
        console.log('Historias recuperadas:', res);
        this.historias.set(res.data.content);
        this.totalRecords.set(res.data.totalElements);
        this.loadingStore.hide();
      },
      error: (err) => {
        console.error('Error al cargar historias:', err);
        this.loadingStore.hide();
      }
    });
  }

  verDetalle(mascotaId: number) {
    this.router.navigate(['/historias-clinicas/mascota', mascotaId]);
  }
}
