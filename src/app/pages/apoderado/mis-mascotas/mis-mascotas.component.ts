import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApoderadoService } from '../../../core/services/apoderado.service';
import { Router } from '@angular/router';
import { MascotaResponse } from '../../../models/response/mascota-response';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { PaginatorModule } from 'primeng/paginator';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-mis-mascotas',
  standalone: true,
  imports: [CommonModule, ToastModule, PaginatorModule, FormsModule],
  providers: [MessageService],
  templateUrl: './mis-mascotas.component.html'
})
export class MisMascotasComponent implements OnInit {
  private readonly apoderadoService = inject(ApoderadoService);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);

  mascotas = signal<MascotaResponse[]>([]);
  isLoading = signal(true);
  totalRecords = signal(0);
  page = signal(0);
  size = signal(6);
  
  viewMode = signal<'list' | 'card'>('card');
  
  filtroNombre = signal<string>('');
  filtroEspecie = signal<string | null>(null);
  filtroEstado = signal<boolean | null>(null);

  especies = [
    { label: 'Todas las especies', value: null },
    { label: 'Perro', value: 'PERRO' },
    { label: 'Gato', value: 'GATO' },
    { label: 'Ave', value: 'AVE' },
    { label: 'Reptil', value: 'REPTIL' },
    { label: 'Roedor', value: 'ROEDOR' },
    { label: 'Exótico', value: 'EXOTICO' },
    { label: 'Otro', value: 'OTRO' }
  ];

  estados = [
    { label: 'Todos los estados', value: null },
    { label: 'Activo', value: true },
    { label: 'Inactivo', value: false }
  ];

  ngOnInit() {
    this.cargarMascotas();
  }

  onFilterChange() {
    this.page.set(0);
    this.cargarMascotas();
  }

  setViewMode(mode: 'list' | 'card') {
    this.viewMode.set(mode);
  }

  cargarMascotas(event?: any) {
    if (event) {
      this.page.set(event.first / event.rows);
      this.size.set(event.rows);
    } else {
      this.isLoading.set(true);
    }
    
    const nombre = this.filtroNombre() || undefined;
    const especie = this.filtroEspecie() || undefined;
    const activo = this.filtroEstado() !== null ? this.filtroEstado()! : undefined;

    this.apoderadoService.getPortalMascotasPaginated(this.page(), this.size(), nombre, especie, activo).subscribe({
      next: (res: any) => {
        this.mascotas.set(res.data?.content || []);
        // Spring Boot 3.2+ nests pagination info under 'page'
        this.totalRecords.set(res.data?.page?.totalElements ?? res.data?.totalElements ?? 0);
        this.isLoading.set(false);
      },
      error: (err: any) => {
        this.isLoading.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar tus mascotas' });
      }
    });
  }

  goToHistorial(mascota: MascotaResponse) {
    this.router.navigate(['/apoderado/mi-historial'], { queryParams: { mascotaId: mascota.id } });
  }

  goToCitas(mascota: MascotaResponse) {
    if (!mascota.activo) {
      this.messageService.add({ severity: 'warn', summary: 'Atención', detail: 'No puedes programar citas para una mascota inactiva.' });
      return;
    }
    this.router.navigate(['/apoderado/mis-citas'], { queryParams: { mascotaId: mascota.id } });
  }
}
