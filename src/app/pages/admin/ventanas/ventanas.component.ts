import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { CdkDrag, CdkDropList, CdkDropListGroup, CdkDragHandle, CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { forkJoin } from 'rxjs';
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
  imports: [CommonModule, FormsModule, ToastModule, CdkDrag, CdkDropList, CdkDropListGroup, CdkDragHandle],
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

  readonly ICONOS_DISPONIBLES = [
    'pi-home','pi-calendar','pi-users','pi-user','pi-cog','pi-chart-bar','pi-chart-line',
    'pi-file','pi-file-edit','pi-list','pi-inbox','pi-folder','pi-folder-open',
    'pi-heart','pi-star','pi-shield','pi-lock','pi-key','pi-dollar','pi-money-bill',
    'pi-briefcase','pi-building','pi-tag','pi-tags','pi-bookmark',
    'pi-bell','pi-envelope','pi-phone','pi-map','pi-map-marker',
    'pi-check','pi-check-circle','pi-times','pi-info-circle','pi-exclamation-triangle',
    'pi-pencil','pi-trash','pi-eye','pi-print','pi-download','pi-upload','pi-share-alt',
    'pi-search','pi-filter','pi-sort-alt','pi-sliders-h',
    'pi-table','pi-th-large','pi-bars','pi-sitemap',
    'pi-box','pi-shopping-cart','pi-credit-card','pi-receipt',
    'pi-image','pi-camera','pi-video','pi-microphone',
    'pi-globe','pi-link','pi-external-link','pi-history',
    'pi-car','pi-palette','pi-wrench','pi-bolt',
  ];

  showIconPicker  = signal(false);
  showAvanzado    = signal(false);
  showInactive    = signal(true);
  filterText      = signal('');
  editingGroupKey  = signal<string | null>(null);
  editingGroupName = signal('');

  vistaForm = signal<{
    id?: number;
    codigo: string;
    nombre: string;
    grupo: string;
    orden: number;
    ordenGrupo: number | null;
    activo: boolean;
    icono: string;
  }>({
    codigo: '',
    nombre: '',
    grupo: 'GENERAL',
    orden: 0,
    ordenGrupo: null,
    activo: true,
    icono: ''
  });

  confirmDialog = signal<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  displayGroups = computed(() => {
    const all = this.vistas();
    const withActive = this.showInactive() ? all : all.filter(v => v.activo);
    const text = this.filterText().toLowerCase().trim();
    const vistas = text
      ? withActive.filter(v =>
          v.nombre.toLowerCase().includes(text) || v.codigo.toLowerCase().includes(text))
      : withActive;

    const groupsMap = new Map<string, VistaDTO[]>();
    for (const v of vistas) {
      const g = v.grupo && v.grupo !== 'GENERAL' ? v.grupo : STANDALONE_KEY;
      if (!groupsMap.has(g)) groupsMap.set(g, []);
      groupsMap.get(g)!.push(v);
    }

    const result: DisplayGroup[] = [];
    for (const [key, items] of groupsMap) {
      result.push({ key, label: key === STANDALONE_KEY ? 'Sin grupo' : this.labelForGroup(key), items });
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
        this.expandAllItems();
        this.loadingStore.hide();
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar las vistas' });
        this.loadingStore.hide();
      }
    });
  }

  onItemDrop(event: CdkDragDrop<VistaDTO[]>, targetGroupKey: string) {
    const groups = this.cloneGroups();

    if (event.previousContainer === event.container) {
      const group = groups.find(g => g.key === targetGroupKey);
      if (!group) return;
      moveItemInArray(group.items, event.previousIndex, event.currentIndex);
    } else {
      const sourceGroupKey: string = event.item.data?.groupKey ?? targetGroupKey;
      const sourceGroup = groups.find(g => g.key === sourceGroupKey);
      const targetGroup = groups.find(g => g.key === targetGroupKey);
      if (!sourceGroup || !targetGroup) return;
      const [moved] = sourceGroup.items.splice(event.previousIndex, 1);
      moved.grupo = targetGroupKey === STANDALONE_KEY ? 'GENERAL' : targetGroupKey;
      moved.ordenGrupo = null;
      targetGroup.items.splice(event.currentIndex, 0, moved);
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
    this.showIconPicker.set(false);
    this.vistaForm.set({
      id: vista.id,
      codigo: vista.codigo,
      nombre: vista.nombre,
      grupo: vista.grupo || 'GENERAL',
      orden: vista.orden ?? 0,
      ordenGrupo: vista.ordenGrupo ?? null,
      activo: vista.activo,
      icono: vista.icono ?? ''
    });
  }

  nuevaVista() {
    this.selectedVista.set(null);
    this.isEditing.set(false);
    this.showIconPicker.set(false);
    this.vistaForm.set({
      codigo: '',
      nombre: '',
      grupo: 'GENERAL',
      orden: 0,
      ordenGrupo: null,
      activo: true,
      icono: ''
    });
  }

  getVistaIcon(vista: VistaDTO): string {
    return vista.icono || this.iconoFallback(vista.codigo);
  }

  private iconoFallback(codigo: string): string {
    const map: Record<string, string> = {
      VISTA_DASHBOARD: 'pi-home', VISTA_COMPANY: 'pi-building',
      VISTA_AUDITORIA_ADMIN: 'pi-list-check', VISTA_ROLES: 'pi-shield',
      VISTA_VENTANAS: 'pi-sitemap', VISTA_COMPLEMENTARIO: 'pi-database',
      VISTA_PAGOS: 'pi-wallet', VISTA_CAJA: 'pi-money-bill',
      VISTA_EMPLEADOS: 'pi-users', VISTA_HORARIOS: 'pi-calendar-clock',
      VISTA_MI_HORARIO: 'pi-clock', VISTA_CLIENTES: 'pi-address-book',
      VISTA_MASCOTAS: 'pi-heart', VISTA_RECETAS: 'pi-file-edit',
      VISTA_HISTORIAS: 'pi-folder-open', VISTA_CITAS_AGENDA: 'pi-calendar',
      VISTA_APODERADO_DASHBOARD: 'pi-chart-line', VISTA_MIS_MASCOTAS: 'pi-heart-fill',
      VISTA_MIS_CITAS: 'pi-calendar-plus', VISTA_MI_HISTORIAL: 'pi-book',
      VISTA_MIS_RECETAS: 'pi-file-edit', VISTA_MIS_PAGOS: 'pi-credit-card',
      VISTA_PROFILE: 'pi-user',
    };
    return map[codigo] || 'pi-circle';
  }

  seleccionarIcono(icono: string) {
    this.updateField('icono', this.vistaForm().icono === icono ? '' : icono);
    this.showIconPicker.set(false);
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
      activo: data.activo,
      icono: data.icono || null
    };

    this.loadingStore.show();
    if (data.id) {
      this.menuService.actualizarVista(data.id, payload).subscribe({
        next: () => {
          this.loadingStore.hide();
          this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Vista actualizada correctamente' });
          this.selectedVista.set(null);
          this.cargarVistas();
        },
        error: (err) => {
          this.loadingStore.hide();
          this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo actualizar la vista' });
        }
      });
    } else {
      this.menuService.crearVista(payload).subscribe({
        next: () => {
          this.loadingStore.hide();
          this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Vista creada correctamente' });
          this.selectedVista.set(null);
          this.cargarVistas();
        },
        error: (err) => {
          this.loadingStore.hide();
          this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo crear la vista' });
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
            this.loadingStore.hide();
            this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Vista eliminada' });
            this.selectedVista.set(null);
            this.cargarVistas();
          },
          error: (err) => {
            this.loadingStore.hide();
            this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo eliminar la vista' });
          }
        });
      }
    });
  }

  cancelConfirm() { this.confirmDialog.set(null); }
  confirmAction() { const d = this.confirmDialog(); if (d) d.onConfirm(); }

  startRenameGroup(group: DisplayGroup) {
    if (group.key === STANDALONE_KEY) return;
    this.editingGroupKey.set(group.key);
    this.editingGroupName.set(group.key);
  }

  confirmRenameGroup(oldKey: string) {
    const newKey = this.editingGroupName().trim().toUpperCase().replace(/\s+/g, '_');
    this.editingGroupKey.set(null);
    if (!newKey || newKey === oldKey) return;
    const toUpdate = this.vistas().filter(v => v.grupo === oldKey);
    if (!toUpdate.length) return;
    this.loadingStore.show();
    forkJoin(toUpdate.map(v =>
      this.menuService.actualizarVista(v.id, {
        nombre: v.nombre, grupo: newKey,
        orden: v.orden, ordenGrupo: v.ordenGrupo, activo: v.activo, icono: v.icono || null
      })
    )).subscribe({
      next: () => {
        this.loadingStore.hide();
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: `Grupo renombrado a "${newKey}"` });
        this.cargarVistas();
      },
      error: () => {
        this.loadingStore.hide();
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo renombrar el grupo' });
      }
    });
  }

  cancelRenameGroup() { this.editingGroupKey.set(null); }

  updateField(field: string, value: any) {
    this.vistaForm.update(c => ({ ...c, [field]: value }));
  }
}
