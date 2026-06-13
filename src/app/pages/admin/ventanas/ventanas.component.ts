import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { MenuManagementService } from '../../../core/services/menu-management.service';
import { VistaDTO } from '../../../models/response/auth-login-response.model';
import { LoadingStore } from '../../../store/loading.store';

const STANDALONE_KEY = '__STANDALONE__';

interface DisplayGroup {
  key: string;
  label: string;
  items: VistaDTO[];
}

@Component({
  selector: 'app-ventanas',
  standalone: true,
  imports: [CommonModule, FormsModule, ToastModule, DragDropModule],
  providers: [MessageService],
  templateUrl: './ventanas.component.html'
})
export class VentanasComponent implements OnInit {
  private readonly menuService = inject(MenuManagementService);
  private readonly messageService = inject(MessageService);
  readonly loadingStore = inject(LoadingStore);
expandedGroups = signal<Set<string>>(new Set());

  vistas = signal<VistaDTO[]>([]);
  selectedVista = signal<VistaDTO | null>(null);
  isEditing = signal<boolean>(false);
  saving = signal(false);

  vistaForm = signal<{
    id?: number;
    codigo: string;
    nombre: string;
    grupo: string;
    orden: number;
    ordenGrupo: number | null;
    activo: boolean;
  }>({
    codigo: '',
    nombre: '',
    grupo: 'GENERAL',
    orden: 0,
    ordenGrupo: null,
    activo: true
  });

  confirmDialog = signal<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  displayGroups = computed(() => {
    const vistas = this.vistas();
    const groupsMap = new Map<string, VistaDTO[]>();

    for (const v of vistas) {
      const g = v.grupo && v.grupo !== 'GENERAL' ? v.grupo : STANDALONE_KEY;
      if (!groupsMap.has(g)) groupsMap.set(g, []);
      groupsMap.get(g)!.push(v);
    }

    const result: DisplayGroup[] = [];

    for (const [key, items] of groupsMap) {
      if (key === STANDALONE_KEY) {
        result.push({ key: STANDALONE_KEY, label: 'Items Sueltos', items });
      } else {
        result.push({ key, label: this.labelForGroup(key), items });
      }
    }

    return result;
  });

  private labelForGroup(key: string): string {
    const map: Record<string, string> = {
      ADMIN: 'Administración',
      RRHH: 'Personal',
      CLINICA: 'Clínica',
      APODERADO: 'Portal Apoderado'
    };
    return map[key] || key;
  }

  itemDropListIds = computed(() => {
    return this.displayGroups().map(g => `items-${g.key}`);
  });

  totalVistas = computed(() => this.vistas().length);
  activeVistas = computed(() => this.vistas().filter(v => v.activo).length);
  inactiveVistas = computed(() => this.vistas().filter(v => !v.activo).length);
  groupsCount = computed(() => this.displayGroups().filter(g => g.key !== STANDALONE_KEY).length);
  standaloneCount = computed(() => this.displayGroups().find(g => g.key === STANDALONE_KEY)?.items.length ?? 0);
  groupOptions = computed(() => this.displayGroups().filter(g => g.key !== STANDALONE_KEY).map(g => g.key));

  openGroup = signal<string | null>(null);

 toggleGroup(groupKey: string) {
  this.expandedGroups.update(groups => {
    const newGroups = new Set(groups);
    if (newGroups.has(groupKey)) {
      newGroups.delete(groupKey);
    } else {
      newGroups.add(groupKey);
    }
    return newGroups;
  });
}
isGroupExpanded(groupKey: string): boolean {
  return this.expandedGroups().has(groupKey);
}

// Expandir todos los grupos
expandAllItems() {
  const allKeys = this.displayGroups().map(g => g.key);
  this.expandedGroups.set(new Set(allKeys));
}

// Añadir vista a un grupo específico
addVistaToGroup(groupKey: string) {
  this.nuevaVista();
  this.updateField('grupo', groupKey === '__STANDALONE__' ? 'GENERAL' : groupKey);
}

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
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar las vistas' });
        this.loadingStore.hide();
      }
    });
  }

  onItemDrop(event: CdkDragDrop<VistaDTO[]>, groupKey: string) {
    const groups = this.cloneGroups();

    const targetGroup = groups.find(g => g.key === groupKey);
    const sourceKey = event.previousContainer.id.replace('items-', '');
    const sourceGroup = groups.find(g => g.key === sourceKey);

    if (!sourceGroup || !targetGroup) return;

    const prevItems = [...sourceGroup.items];
    const [moved] = prevItems.splice(event.previousIndex, 1);
    sourceGroup.items = prevItems;

    const currItems = [...targetGroup.items];
    currItems.splice(event.currentIndex, 0, moved);
    targetGroup.items = currItems;

    moved.grupo = groupKey === STANDALONE_KEY ? 'GENERAL' : groupKey;
    moved.ordenGrupo = null;

    if (sourceGroup.items.length === 0 && sourceGroup.key !== STANDALONE_KEY) {
      // remove empty group from display
    }

    this.vistas.set(this.flattenGroups(groups));
    this.saving.set(true);
    this.saveOrder(groups);
  }

  private cloneGroups(): DisplayGroup[] {
    return this.displayGroups().map(g => ({ ...g, items: [...g.items] }));
  }

  private flattenGroups(groups: DisplayGroup[]): VistaDTO[] {
    return groups.flatMap(g => g.items);
  }

  private saveOrder(groups: DisplayGroup[]) {
    const payload: { id: number; orden: number; grupo: string; ordenGrupo: number | null }[] = [];

    groups.forEach((group, groupIdx) => {
      if (group.key === STANDALONE_KEY) {
        group.items.forEach((item, itemIdx) => {
          payload.push({
            id: item.id,
            orden: (itemIdx + 1) * 10,
            grupo: 'GENERAL',
            ordenGrupo: null
          });
        });
      } else {
        group.items.forEach((item, itemIdx) => {
          payload.push({
            id: item.id,
            orden: (itemIdx + 1) * 10,
            grupo: group.key,
            ordenGrupo: (groupIdx + 1) * 10
          });
        });
      }
    });

    this.menuService.reordenarVistas(payload).subscribe({
      next: () => this.saving.set(false),
      error: () => {
        this.saving.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo guardar el orden' });
        this.cargarVistas();
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
      orden: vista.orden ?? 0,
      ordenGrupo: vista.ordenGrupo ?? null,
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
      orden: 0,
      ordenGrupo: null,
      activo: true
    });
  }

  guardarVista() {
    const data = this.vistaForm();
    const codigo = data.codigo.trim();
    const nombre = data.nombre.trim();
    const grupo = data.grupo.trim();
    if (!codigo || !nombre || !grupo) {
      this.messageService.add({ severity: 'warn', summary: 'Atención', detail: 'Código y Nombre son obligatorios' });
      return;
    }

    if (!/^[A-Za-z0-9_\s-]{3,80}$/.test(codigo)) {
      this.messageService.add({ severity: 'warn', summary: 'Codigo invalido', detail: 'Use entre 3 y 80 caracteres validos.' });
      return;
    }
    if (nombre.length < 2 || nombre.length > 80) {
      this.messageService.add({ severity: 'warn', summary: 'Nombre invalido', detail: 'El nombre debe tener entre 2 y 80 caracteres.' });
      return;
    }
    if (!/^[A-Za-z0-9_\s-]{1,40}$/.test(grupo)) {
      this.messageService.add({ severity: 'warn', summary: 'Grupo invalido', detail: 'El grupo no debe superar 40 caracteres.' });
      return;
    }

    const payload = {
      codigo: codigo.toUpperCase().replace(/\s+/g, '_'),
      nombre,
      grupo: grupo.toUpperCase().replace(/\s+/g, '_'),
      orden: data.orden,
      ordenGrupo: data.ordenGrupo,
      activo: data.activo
    };

    this.loadingStore.show();
    if (data.id) {
      this.menuService.actualizarVista(data.id, payload).subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Vista actualizada correctamente' });
          this.cargarVistas();
          this.selectedVista.set(null);
        },
        error: (err) => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo actualizar la vista' });
          this.loadingStore.hide();
        }
      });
    } else {
      this.menuService.crearVista(payload).subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Vista creada correctamente' });
          this.cargarVistas();
          this.selectedVista.set(null);
        },
        error: (err) => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo crear la vista' });
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
            this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Vista eliminada' });
            this.selectedVista.set(null);
            this.cargarVistas();
          },
          error: (err) => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo eliminar la vista' });
            this.loadingStore.hide();
          }
        });
      }
    });
  }

  cancelConfirm() { this.confirmDialog.set(null); }
  confirmAction() { const d = this.confirmDialog(); if (d) d.onConfirm(); }

  updateField(field: string, value: any) {
    this.vistaForm.update(c => ({ ...c, [field]: value }));
  }
}
