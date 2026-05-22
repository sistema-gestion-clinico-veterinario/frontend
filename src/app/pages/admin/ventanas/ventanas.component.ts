import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { MenuManagementService } from '../../../core/services/menu-management.service';
import { VistaDTO } from '../../../models/response/auth-login-response.model';
import { LoadingStore } from '../../../store/loading.store';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';

interface VistaGrupo {
  grupo: string;
  vistas: VistaDTO[];
}

@Component({
  selector: 'app-ventanas',
  standalone: true,
  imports: [CommonModule, FormsModule, ToastModule, HasPermissionDirective],
  providers: [MessageService],
  templateUrl: './ventanas.component.html',
  styleUrl: './ventanas.component.scss'
})
export class VentanasComponent implements OnInit {
  private readonly menuService = inject(MenuManagementService);
  private readonly messageService = inject(MessageService);
  readonly loadingStore = inject(LoadingStore);

  vistas = signal<VistaDTO[]>([]);
  selectedVista = signal<VistaDTO | null>(null);
  isEditing = signal<boolean>(false);

  vistaForm = signal<{
    id?: number;
    codigo: string;
    nombre: string;
    grupo: string;
    activo: boolean;
  }>({
    codigo: '',
    nombre: '',
    grupo: 'GENERAL',
    activo: true
  });

  grupos = ['GENERAL', 'ADMIN', 'RRHH', 'CLINICA', 'APODERADO'];

  vistasPorGrupo = computed(() => {
    const vistas = this.vistas();
    const grouped: { [key: string]: VistaDTO[] } = {};

    this.grupos.forEach(g => {
      grouped[g] = vistas.filter(v => v.grupo === g);
    });

    return Object.entries(grouped)
      .filter(([_, items]) => items.length > 0)
      .map(([grupo, items]) => ({ grupo, vistas: items }));
  });

  confirmDialog = signal<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  ngOnInit() {
    this.cargarVistas();
  }

  cargarVistas() {
    this.loadingStore.show();
    this.menuService.listarVistas().subscribe({
      next: (res) => {
        this.vistas.set(res.data);
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo cargar las vistas'
        });
        this.loadingStore.hide();
      }
    });
  }

  selectVista(vista: VistaDTO) {
    this.selectedVista.set(vista);
    this.isEditing.set(true);
    this.vistaForm.set({
      id: vista.id,
      codigo: vista.codigo,
      nombre: vista.nombre,
      grupo: vista.grupo || 'GENERAL',
      activo: vista.activo
    });
  }

  nuevaVista() {
    this.selectedVista.set(null);
    this.isEditing.set(false);
    this.vistaForm.set({
      codigo: '',
      nombre: '',
      grupo: 'GENERAL',
      activo: true
    });
  }

  guardarVista() {
    const data = this.vistaForm();
    if (!data.codigo || !data.nombre) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Atención',
        detail: 'Código y Nombre son obligatorios'
      });
      return;
    }

    const payload = {
      codigo: data.codigo.toUpperCase().trim().replace(/\s+/g, '_'),
      nombre: data.nombre.trim(),
      grupo: data.grupo,
      activo: data.activo
    };

    this.loadingStore.show();
    if (data.id) {
      this.menuService.actualizarVista(data.id, payload).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Vista actualizada correctamente'
          });
          this.cargarVistas();
          this.selectedVista.set(null);
        },
        error: (err) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: err.error?.message || 'No se pudo actualizar la vista'
          });
          this.loadingStore.hide();
        }
      });
    } else {
      this.menuService.crearVista(payload).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Vista creada correctamente'
          });
          this.cargarVistas();
          this.selectedVista.set(null);
        },
        error: (err) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: err.error?.message || 'No se pudo crear la vista'
          });
          this.loadingStore.hide();
        }
      });
    }
  }

  eliminarVista() {
    const v = this.selectedVista();
    if (!v) return;

    this.confirmDialog.set({
      title: 'Eliminar Vista',
      message: `¿Estás seguro de que deseas eliminar "${v.nombre}"?`,
      onConfirm: () => {
        this.confirmDialog.set(null);
        this.loadingStore.show();
        this.menuService.eliminarVista(v.id).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Éxito',
              detail: 'Vista eliminada'
            });
            this.selectedVista.set(null);
            this.cargarVistas();
          },
          error: (err) => {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: err.error?.message || 'No se pudo eliminar la vista'
            });
            this.loadingStore.hide();
          }
        });
      }
    });
  }

  cancelConfirm() {
    this.confirmDialog.set(null);
  }

  confirmAction() {
    const dialog = this.confirmDialog();
    if (dialog) dialog.onConfirm();
  }

  updateField(field: string, value: any) {
    this.vistaForm.update(current => ({
      ...current,
      [field]: value
    } as any));
  }
}
