import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { CdkDrag, CdkDropList, CdkDropListGroup, CdkDragHandle, CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { MenuManagementService } from '../../../core/services/menu-management.service';
import { VentanaDTO, VistaReordenItem } from '../../../models/menu/menu-management.model';
import { VistaDTO } from '../../../models/response/auth-login-response.model';
import { LoadingStore } from '../../../store/loading.store';
import { hasMeaningfulText } from '../../../core/utils/input-validation.util';

const STANDALONE_KEY = '__STANDALONE__';

interface DisplayGroup {
  key: string;
  label: string;
  ventanaId: number | null;
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
  ventanas = signal<VentanaDTO[]>([]);
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
    ventanaId: number | null;
    orden: number;
    ordenGrupo: number | null;
    activo: boolean;
    icono: string;
  }>({
    codigo: '',
    nombre: '',
    grupo: 'GENERAL',
    ventanaId: null,
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

  reordenHabilitado = computed(() => this.showInactive() && !this.filterText().trim());

  displayGroups = computed(() => {
    const text = this.filterText().toLowerCase().trim();
    const base = this.showInactive() ? this.vistas() : this.vistas().filter(v => v.activo);
    const visibles = text
      ? base.filter(v => v.nombre.toLowerCase().includes(text) || v.codigo.toLowerCase().includes(text))
      : base;

    const grupos = new Map<string, DisplayGroup>();
    const modulos = [...this.ventanas()].sort(
      (a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.nombre.localeCompare(b.nombre));
    for (const modulo of modulos) {
      if (!text || visibles.some(v => v.ventanaId === modulo.id)) {
        grupos.set(String(modulo.id), {
          key: String(modulo.id),
          label: modulo.activo ? modulo.nombre : `${modulo.nombre} (inactivo)`,
          ventanaId: modulo.id,
          items: []
        });
      }
    }
    for (const vista of visibles) {
      const key = vista.ventanaId != null ? String(vista.ventanaId) : STANDALONE_KEY;
      if (!grupos.has(key)) {
        grupos.set(key, {
          key,
          label: key === STANDALONE_KEY ? 'Sin módulo' : (vista.ventanaNombre ?? `Módulo ${key}`),
          ventanaId: vista.ventanaId ?? null,
          items: []
        });
      }
      grupos.get(key)!.items.push(vista);
    }
    if (!text && !grupos.has(STANDALONE_KEY)) {
      grupos.set(STANDALONE_KEY, { key: STANDALONE_KEY, label: 'Sin módulo', ventanaId: null, items: [] });
    }

    const resultado = [...grupos.values()];
    for (const grupo of resultado) {
      grupo.items.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.nombre.localeCompare(b.nombre));
    }
    return resultado.sort((a, b) =>
      Number(a.key === STANDALONE_KEY) - Number(b.key === STANDALONE_KEY));
  });

  totalVistas = computed(() => this.vistas().length);
  activeVistas = computed(() => this.vistas().filter(v => v.activo).length);
  inactiveVistas = computed(() => this.vistas().filter(v => !v.activo).length);
  groupsCount = computed(() => this.displayGroups().filter(g => g.key !== STANDALONE_KEY).length);
  standaloneCount = computed(() => this.displayGroups().find(g => g.key === STANDALONE_KEY)?.items.length ?? 0);

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

addVistaToGroup(groupKey: string) {
  this.nuevaVista();
  this.updateField('ventanaId', groupKey === STANDALONE_KEY ? null : Number(groupKey));
}

  ngOnInit() {
    this.cargarVistas();
    this.cargarVentanas();
  }

  cargarVentanas() {
    this.menuService.listarVentanas().subscribe({
      next: (res) => this.ventanas.set(res.data),
      error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar las ventanas' })
    });
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

  onItemDrop(event: CdkDragDrop<VistaDTO[]>, targetGroupKey: string) {
    if (!this.reordenHabilitado() || this.saving()) return;
    const groups = this.cloneGroups();
    const target = groups.find(g => g.key === targetGroupKey);
    if (!target) return;

    if (event.previousContainer === event.container) {
      moveItemInArray(target.items, event.previousIndex, event.currentIndex);
    } else {
      const sourceGroupKey: string = event.item.data?.groupKey ?? targetGroupKey;
      const source = groups.find(g => g.key === sourceGroupKey);
      if (!source) return;
      const [moved] = source.items.splice(event.previousIndex, 1);
      target.items.splice(event.currentIndex, 0, moved);
    }

    this.saving.set(true);
    this.saveOrder(groups);
  }

  private cloneGroups(): DisplayGroup[] {
    return this.displayGroups().map(g => ({ ...g, items: [...g.items] }));
  }

  private saveOrder(groups: DisplayGroup[]) {
    const payload: VistaReordenItem[] = groups.flatMap(group =>
      group.items.map((item, index) => ({
        id: item.id,
        orden: (index + 1) * 10,
        ventanaId: group.ventanaId,
        sinModulo: group.ventanaId === null
      })));

    const anterior = this.vistas();
    const cambios = new Map(groups.flatMap(group =>
      group.items.map((item, index) => [item.id, {
        orden: (index + 1) * 10,
        ventanaId: group.ventanaId,
        ventanaNombre: group.ventanaId === null ? undefined : group.label
      }] as const)));
    this.vistas.set(anterior.map(v => cambios.has(v.id) ? { ...v, ...cambios.get(v.id)! } : v));

    this.menuService.reordenarVistas(payload).subscribe({
      next: () => this.saving.set(false),
      error: (err) => {
        this.saving.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo guardar el orden' });
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
      ventanaId: vista.ventanaId ?? null,
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
      ventanaId: null,
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
    if (nombre.length < 2 || nombre.length > 80 || !hasMeaningfulText(nombre, false)) {
      this.messageService.add({ severity: 'warn', summary: 'Nombre invalido', detail: 'El nombre debe tener entre 2 y 80 caracteres.' });
      return;
    }
    if (!/^[A-Za-z0-9_\s-]{1,40}$/.test(grupo) || /^[\W_]+$/.test(grupo)) {
      this.messageService.add({ severity: 'warn', summary: 'Grupo invalido', detail: 'El grupo no debe superar 40 caracteres.' });
      return;
    }
    if (data.orden != null && (Number(data.orden) < 0 || Number(data.orden) > 10000)) {
      this.messageService.add({ severity: 'warn', summary: 'Orden invalido', detail: 'El orden debe estar entre 0 y 10000.' });
      return;
    }

    const payload = {
      codigo: codigo.toUpperCase().replace(/\s+/g, '_'),
      nombre,
      grupo: grupo.toUpperCase().replace(/\s+/g, '_'),
      ventanaId: data.ventanaId,
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
    if (group.ventanaId === null) return;
    this.editingGroupKey.set(group.key);
    this.editingGroupName.set(this.ventanas().find(v => v.id === group.ventanaId)?.nombre ?? '');
  }

  confirmRenameGroup(key: string) {
    const nuevoNombre = this.editingGroupName().trim();
    this.editingGroupKey.set(null);
    const modulo = this.ventanas().find(v => String(v.id) === key);
    if (!modulo || !nuevoNombre || nuevoNombre === modulo.nombre) return;
    if (nuevoNombre.length < 2 || nuevoNombre.length > 80 || !hasMeaningfulText(nuevoNombre, false)) {
      this.messageService.add({ severity: 'warn', summary: 'Nombre invalido', detail: 'El nombre del módulo debe tener entre 2 y 80 caracteres.' });
      return;
    }
    this.loadingStore.show();
    this.menuService.actualizarVentana(modulo.id, { ...modulo, nombre: nuevoNombre }).subscribe({
      next: () => {
        this.loadingStore.hide();
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: `Módulo renombrado a "${nuevoNombre}"` });
        this.cargarVentanas();
        this.cargarVistas();
      },
      error: (err) => {
        this.loadingStore.hide();
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo renombrar el módulo' });
      }
    });
  }

  cancelRenameGroup() { this.editingGroupKey.set(null); }

  updateField(field: string, value: any) {
    this.vistaForm.update(c => ({ ...c, [field]: value }));
  }
}
