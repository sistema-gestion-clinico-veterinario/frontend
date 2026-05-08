import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { map } from 'rxjs';
import { MenuManagementService } from '../../../core/services/menu-management.service';
import { Menu } from '../../../models/response/auth-login-response.model';
import { Permission } from '../../../models/response/permission';
import { RoleService } from '../../../core/services/role.service';
import { MenuFormComponent } from './menu-form/menu-form.component';

@Component({
  selector: 'app-menu-management',
  standalone: true,
  imports: [CommonModule, MenuFormComponent],
  templateUrl: './menu-management.component.html',
  styleUrl: './menu-management.component.scss'
})
export class MenuManagementComponent implements OnInit {
  private menuService = inject(MenuManagementService);
  private roleService = inject(RoleService);

  allMenusRaw = signal<Menu[]>([]);
  
  // Lógica optimizada para tu JSON: Filtramos duplicados que ya están anidados
  menus = computed(() => {
    const raw = this.allMenusRaw();
    if (!raw.length) return [];

    // 1. Identificamos todos los IDs que ya son hijos de alguien
    const childIds = new Set<number>();
    raw.forEach(item => {
      if (item.children && item.children.length > 0) {
        item.children.forEach(child => childIds.add(child.id));
      }
    });

    // 2. Solo dejamos como "Raíces" a los que NO son hijos de nadie
    // Y ordenamos por sortOrder
    return raw
      .filter(item => !childIds.has(item.id))
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  });

  permissions = signal<Permission[]>([]);
  expandedNodes = signal<Set<number>>(new Set());
  selectedId = signal<number | null>(null);
  editingItem = signal<Partial<Menu> | null>(null);
  showModal = signal(false);

  hierarchicalOptions = computed(() => {
    // Para el formulario, necesitamos una lista plana de nombres
    return this.allMenusRaw().map(m => ({ id: m.id, label: m.label }));
  });

  ngOnInit() { this.loadData(); }

  loadData() {
    this.menuService.listarTodo().pipe(map(res => res.data)).subscribe(data => this.allMenusRaw.set(data));
    this.roleService.listarPermisos().pipe(map(res => res.data)).subscribe(data => this.permissions.set(data));
  }

  toggleRow(id: number) {
    const newSet = new Set(this.expandedNodes());
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    this.expandedNodes.set(newSet);
  }

  isExpanded(id: number): boolean { return this.expandedNodes().has(id); }

  prepareNew() {
    this.selectedId.set(null);
    this.editingItem.set(null);
    this.showModal.set(true);
  }

  addChild(parent: Menu) {
    this.selectedId.set(null);
    this.editingItem.set({
      label: '',
      icon: 'pi pi-circle',
      path: parent.path ? `${parent.path}/` : '/',
      sortOrder: (parent.children?.length || 0) + 1,
      parentId: parent.id,
      active: true
    });
    this.showModal.set(true);
  }

  edit(item: Menu, pId?: number) {
    this.selectedId.set(item.id);
    const parentId = pId || item.parentId || (item as any).parent?.id || undefined;
    this.editingItem.set({ ...item, parentId });
    this.showModal.set(true);
  }

  confirmVisible = signal(false);
  confirmMessage = signal('');
  confirmAction = signal<(() => void) | null>(null);

  showConfirm(message: string, action: () => void) {
    this.confirmMessage.set(message);
    this.confirmAction.set(action);
    this.confirmVisible.set(true);
  }

  acceptConfirm() {
    this.confirmAction()?.();
    this.confirmVisible.set(false);
  }

  cancelConfirm() {
    this.confirmVisible.set(false);
    this.confirmAction.set(null);
  }

  handleSave(data: any) {
    const id = this.selectedId();
    const msg = id
      ? '¿Estás seguro de actualizar este menú?'
      : '¿Estás seguro de crear este menú?';

    this.showConfirm(msg, () => {
      const obs = id ? this.menuService.actualizar(id, data) : this.menuService.crear(data);
      obs.subscribe(() => {
        this.loadData();
        this.showModal.set(false);
        this.selectedId.set(null);
        this.editingItem.set(null);
      });
    });
  }

  deleteMenu(id: number) {
    this.showConfirm('¿Estás seguro de eliminar este menú? Esta acción no se puede deshacer.', () => {
      this.menuService.eliminar(id).subscribe(() => this.loadData());
    });
  }

  getBadgeClasses(perm?: string): string {
    if (!perm) return 'bg-slate-50 text-slate-400 border-slate-100';
    const p = perm.toUpperCase();
    if (p.includes('USER')) return 'bg-purple-50 text-purple-600 border-purple-100';
    if (p.includes('COMPANY')) return 'bg-orange-50 text-orange-600 border-orange-100';
    if (p.includes('PET')) return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    if (p.includes('CITA')) return 'bg-blue-50 text-blue-600 border-blue-100';
    return 'bg-blue-50 text-blue-600 border-blue-100';
  }
}
