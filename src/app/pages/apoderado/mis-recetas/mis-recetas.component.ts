import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ApoderadoService } from '../../../core/services/apoderado.service';
import { PrescripcionResponse } from '../../../models/response/prescripcion-response';

@Component({
  selector: 'app-mis-recetas',
  standalone: true,
  imports: [CommonModule, FormsModule, ToastModule],
  providers: [MessageService],
  templateUrl: './mis-recetas.component.html'
})
export class MisRecetasComponent implements OnInit {
  private readonly apoderadoService = inject(ApoderadoService);
  private readonly messageService = inject(MessageService);

  recetas = signal<PrescripcionResponse[]>([]);
  isLoading = signal(true);
  searchQuery = signal('');
  selectedReceta = signal<PrescripcionResponse | null>(null);

  ngOnInit() {
    this.cargarRecetas();
  }

  cargarRecetas() {
    this.isLoading.set(true);
    this.apoderadoService.getPortalRecetas().subscribe({
      next: (res) => {
        this.recetas.set(res.data ?? []);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar tus recetas.' });
      }
    });
  }

  recetasFiltradas(): PrescripcionResponse[] {
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) return this.recetas();

    return this.recetas().filter((receta) =>
      [
        receta.pacienteNombre,
        receta.numeroHc,
        receta.medicamento,
        receta.principioActivo,
        receta.veterinarioNombre
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query))
    );
  }

  verDetalle(receta: PrescripcionResponse) {
    this.selectedReceta.set(receta);
  }

  cerrarDetalle() {
    this.selectedReceta.set(null);
  }

  formatFecha(fecha?: string): string {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
