import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApoderadoService } from '../../../core/services/apoderado.service';
import { Router } from '@angular/router';
import { MascotaResponse } from '../../../models/response/mascota-response';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { PaginatorModule } from 'primeng/paginator';
import { FormsModule } from '@angular/forms';
import { normalizeText } from '../../../core/utils/normalize-text.util';
import { hasMeaningfulText } from '../../../core/utils/input-validation.util';

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
    
    const nombre = normalizeText(this.filtroNombre()).slice(0, 80);
    if (nombre && !hasMeaningfulText(nombre)) {
      this.messageService.add({ severity: 'warn', summary: 'Filtro invalido', detail: 'Busca por un nombre con texto real.' });
      this.isLoading.set(false);
      return;
    }
    const especie = this.filtroEspecie() || undefined;
    const activo = this.filtroEstado() !== null ? this.filtroEstado()! : undefined;

    this.apoderadoService.getPortalMascotasPaginated(this.page(), this.size(), nombre || undefined, especie, activo).subscribe({
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

  formatFechaNacimiento(fecha: string | null | undefined, formato: 'short' | 'long' = 'short'): string {
    const parsed = this.parseFecha(fecha);
    if (!parsed) return formato === 'long' ? 'No registrado' : 'N/A';

    return new Intl.DateTimeFormat('es-PE', {
      day: '2-digit',
      month: formato === 'long' ? 'long' : '2-digit',
      year: 'numeric'
    }).format(parsed);
  }

  private parseFecha(fecha: string | null | undefined): Date | null {
    if (!fecha) return null;

    const value = String(fecha).trim();
    if (!value) return null;

    const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dateOnly) {
      const year = Number(dateOnly[1]);
      const month = Number(dateOnly[2]);
      const day = Number(dateOnly[3]);
      const parsed = new Date(year, month - 1, day);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
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
