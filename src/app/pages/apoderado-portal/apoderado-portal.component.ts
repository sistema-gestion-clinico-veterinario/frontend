import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ApoderadoService } from '../../core/services/apoderado.service';
import { AuthStore } from '../../store/auth.store';
import { LoadingStore } from '../../store/loading.store';

@Component({
  selector: 'app-apoderado-portal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    TableModule,
    ButtonModule,
    DialogModule,
    ToastModule,
    RouterModule
  ],
  providers: [MessageService],
  templateUrl: './apoderado-portal.component.html',
  styleUrl: './apoderado-portal.component.scss'
})
export class ApoderadoPortalComponent implements OnInit {
  private readonly apoderadoService = inject(ApoderadoService);
  private readonly messageService = inject(MessageService);
  readonly authStore = inject(AuthStore);
  readonly loadingStore = inject(LoadingStore);

  // Portal Signals
  activeTab = signal<string>('mascotas');
  perfil = signal<any>(null);
  mascotas = signal<any[]>([]);
  citas = signal<any[]>([]);
  recetas = signal<any[]>([]);

  // Historia Clinica Modals
  selectedPetHistoria = signal<any>(null);
  displayHistoriaModal = signal<boolean>(false);

  ngOnInit() {
    this.loadInitialData();
  }

  loadInitialData() {
    this.loadingStore.show();
    this.apoderadoService.getPortalPerfil().subscribe({
      next: (res) => {
        this.perfil.set(res.data);
        this.loadMascotas();
        this.loadCitas();
        this.loadRecetas();
      },
      error: (err: any) => {
        this.messageService.add({ severity: 'error', summary: 'Error de acceso', detail: 'No se pudo cargar el perfil del propietario.' });
        this.loadingStore.hide();
      }
    });
  }

  loadMascotas() {
    this.apoderadoService.getPortalMascotas().subscribe({
      next: (res) => this.mascotas.set(res.data),
      error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron obtener tus mascotas.' })
    });
  }

  loadCitas() {
    this.apoderadoService.getPortalCitas().subscribe({
      next: (res) => {
        this.citas.set(res.data);
        this.loadingStore.hide();
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron obtener tus citas.' });
        this.loadingStore.hide();
      }
    });
  }

  loadRecetas() {
    this.apoderadoService.getPortalRecetas().subscribe({
      next: (res) => this.recetas.set(res.data),
      error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron obtener tus recetas médicas.' })
    });
  }

  changeTab(tab: string) {
    this.activeTab.set(tab);
  }

  verHistoriaClinica(mascota: any) {
    this.loadingStore.show();
    this.apoderadoService.getPortalMascotaHistoria(mascota.id).subscribe({
      next: (res) => {
        this.selectedPetHistoria.set({
          mascota,
          historia: res.data
        });
        this.displayHistoriaModal.set(true);
        this.loadingStore.hide();
      },
      error: (err: any) => {
        this.messageService.add({ 
          severity: 'info', 
          summary: 'Historial Clínico', 
          detail: 'Esta mascota aún no cuenta con atenciones registradas.' 
        });
        this.loadingStore.hide();
      }
    });
  }

  getEspecieIcon(especie: string): string {
    switch (especie?.toUpperCase()) {
      case 'PERRO': return 'pi pi-tag text-sky-500';
      case 'GATO': return 'pi pi-tag text-emerald-500';
      default: return 'pi pi-tag text-indigo-500';
    }
  }
}
