import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { RoleService } from '../../../core/services/role.service';
import { LoadingStore } from '../../../store/loading.store';
import { AuthStore } from '../../../store/auth.store';
import { Permission as PermissionModel, Role } from '../../../models/response/permission';
import { Menu } from '../../../models/response/auth-login-response.model';

type Tab = 'permisos' | 'menus';
type Section = 'empresa' | 'sistema';

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [CommonModule, ToastModule, FormsModule],
  providers: [MessageService],
  templateUrl: './roles.component.html',
  styleUrl: './roles.component.scss'
})
export class RolesComponent implements OnInit {
  private readonly roleService = inject(RoleService);
  private readonly messageService = inject(MessageService);
  private readonly authStore = inject(AuthStore);
  readonly loadingStore = inject(LoadingStore);

  isSuperAdmin = computed(() => (this.authStore.roles() ?? []).includes('ROLE_SUPER_ADMIN'));
  isAdminOrSuperAdmin = computed(() => {
    const userRoles = this.authStore.roles() ?? [];
    return userRoles.includes('ROLE_SUPER_ADMIN') || userRoles.includes('ROLE_ADMIN');
  });

  get activeCompanyId(): number | null {
    return this.authStore.selectedEnterprise()?.establishmentId ?? this.authStore.companyId();
  }

  constructor() {
    effect(() => {
      const activeId = this.authStore.selectedEnterprise()?.establishmentId ?? this.authStore.companyId();
      this.selectedRole.set(null);
      this.loadCompanyRoles(activeId);
    }, { allowSignalWrites: true });
  }

  companyRoles = signal<Role[]>([]);
  systemRoles  = signal<Role[]>([]);

  allPermissions = signal<PermissionModel[]>([]);
  allMenusFlat   = signal<Menu[]>([]);

  selectedRole    = signal<Role | null>(null);
  pendingPermIds  = signal<Set<number>>(new Set());
  pendingMenuIds  = signal<Set<number>>(new Set());
  activeTab       = signal<Tab>('permisos');
  activeSection   = signal<Section>('empresa');

  showCreateModal = signal<boolean>(false);
  newRoleName     = signal<string>('');
  confirmDialog   = signal<{ title: string; message: string; onConfirm: () => void; variant?: 'danger' | 'primary' } | null>(null);

  isEditingName    = signal<boolean>(false);
  editingNameValue = signal<string>('');

  readonly modules = computed(() => {
    const map = new Map<string, PermissionModel[]>();
    for (const p of this.allPermissions()) {
      const list = map.get(p.module) ?? [];
      list.push(p);
      map.set(p.module, list);
    }
    return map;
  });

  readonly rootMenus = computed(() => {
    const all = this.allMenusFlat();
    if (!all.length) return [];
    const childIds = new Set<number>();
    all.forEach(m => m.children?.forEach(c => childIds.add(c.id)));
    return all
      .filter(m => !childIds.has(m.id))
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  });

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loadingStore.show();

    const activeId = this.activeCompanyId;
    this.loadCompanyRoles(activeId);

    if (this.isSuperAdmin()) {
      this.roleService.listarSistema().subscribe({
        next: (res) => { this.systemRoles.set(res.data); this.loadingStore.hide(); },
        error: () => this.loadingStore.hide()
      });
    } else {
      this.loadingStore.hide();
    }

    this.roleService.listarPermisos().subscribe({
      next: (res) => this.allPermissions.set(res.data)
    });
    this.roleService.listarMenus().subscribe({
      next: (res) => this.allMenusFlat.set(res.data)
    });
  }

  loadCompanyRoles(companyId: number | null | undefined) {
    if (!companyId) {
      this.companyRoles.set([]);
      return;
    }
    this.roleService.listarPorEmpresa(companyId).subscribe({
      next: (res) => this.companyRoles.set(res.data)
    });
  }



  setSection(s: Section) {
    this.activeSection.set(s);
    this.selectedRole.set(null);
    this.pendingPermIds.set(new Set());
    this.pendingMenuIds.set(new Set());
    this.isEditingName.set(false);
    this.editingNameValue.set('');
  }

  selectRole(role: Role) {
    this.selectedRole.set(role);
    this.pendingPermIds.set(new Set(role.permissions.map(p => p.id)));
    this.pendingMenuIds.set(new Set(role.menuIds));
    this.isEditingName.set(false);
    this.editingNameValue.set('');
  }

  setTab(tab: Tab) { this.activeTab.set(tab); }

  // ---- Permisos ----
  togglePermission(id: number) {
    const s = new Set(this.pendingPermIds());
    s.has(id) ? s.delete(id) : s.add(id);
    this.pendingPermIds.set(s);
  }
  hasPermission(id: number) { return this.pendingPermIds().has(id); }

  // ---- Menús ----
  toggleMenu(id: number) {
    const s = new Set(this.pendingMenuIds());
    s.has(id) ? s.delete(id) : s.add(id);
    this.pendingMenuIds.set(s);
  }
  hasMenu(id: number) { return this.pendingMenuIds().has(id); }

  toggleMenuWithChildren(menu: Menu) {
    const s = new Set(this.pendingMenuIds());
    const ids = this.collectIds(menu);
    const allSelected = ids.every(id => s.has(id));
    ids.forEach(id => allSelected ? s.delete(id) : s.add(id));
    this.pendingMenuIds.set(s);
  }
  allChildrenSelected(menu: Menu) {
    if (!menu.children || menu.children.length === 0) return false;
    return menu.children.every(c => this.pendingMenuIds().has(c.id));
  }
  someChildrenSelected(menu: Menu) {
    return (menu.children ?? []).some(c => this.pendingMenuIds().has(c.id))
        && !(menu.children ?? []).every(c => this.pendingMenuIds().has(c.id));
  }
  private collectIds(menu: Menu): number[] {
    return [menu.id, ...(menu.children ?? []).flatMap(c => this.collectIds(c))];
  }

  // ---- Dirty / Save ----
  isDirty(): boolean {
    const role = this.selectedRole();
    if (!role || !this.canEditRole(role)) return false;

    let nameChanged = false;
    if (this.isEditingName() && this.editingNameValue().trim()) {
      let formattedName = this.editingNameValue().trim().toUpperCase();
      if (!formattedName.startsWith('ROLE_')) {
        formattedName = 'ROLE_' + formattedName;
      }
      formattedName = formattedName.replace(/\s+/g, '_');
      nameChanged = formattedName !== role.name;
    }

    return nameChanged ||
           !this.setsEqual(new Set(role.permissions.map(p => p.id)), this.pendingPermIds()) ||
           !this.setsEqual(new Set(role.menuIds), this.pendingMenuIds());
  }

  canEditRole(role: Role | null): boolean {
    if (!role) return false;
    return this.isAdminOrSuperAdmin();
  }

  canRenameRole(role: Role | null): boolean {
    if (!role) return false;
    if (!this.isAdminOrSuperAdmin()) return false;
    // No permitir renombrar los roles centrales del sistema
    const protectedRoles = ['ROLE_SUPER_ADMIN', 'ROLE_ADMIN'];
    return !protectedRoles.includes(role.name);
  }

  startEditName() {
    const role = this.selectedRole();
    if (!role) return;
    let cleanName = role.name;
    if (cleanName.startsWith('ROLE_')) {
      cleanName = cleanName.substring(5);
    }
    this.editingNameValue.set(cleanName);
    this.isEditingName.set(true);
  }

  cancelEditName() {
    this.isEditingName.set(false);
    this.editingNameValue.set('');
  }

  private setsEqual(a: Set<number>, b: Set<number>): boolean {
    if (a.size !== b.size) return false;
    for (const v of a) if (!b.has(v)) return false;
    return true;
  }

  save() {
    const role = this.selectedRole();
    if (!role) return;

    this.confirmDialog.set({
      title: 'Guardar cambios',
      message: `¿Estás seguro de guardar los cambios en el rol "${this.roleLabel(role.name)}"?`,
      variant: 'primary',
      onConfirm: () => this.executeSave()
    });
  }

  private executeSave() {
    const role = this.selectedRole();
    if (!role) return;
    this.loadingStore.show();
    const currentRole = this.selectedRole();
    const effectiveCompanyId = currentRole ? currentRole.companyId : this.activeCompanyId;

    let finalName = role.name;
    if (this.isEditingName() && this.editingNameValue().trim()) {
      let formattedName = this.editingNameValue().trim().toUpperCase();
      if (!formattedName.startsWith('ROLE_')) {
        formattedName = 'ROLE_' + formattedName;
      }
      formattedName = formattedName.replace(/\s+/g, '_');

      // Validar que el nombre no esté duplicado en otro rol
      const nameExists = [...this.companyRoles(), ...this.systemRoles()].some(
        r => r.id !== role.id && r.name.toUpperCase() === formattedName
      );
      if (nameExists) {
        this.messageService.add({
          severity: 'error',
          summary: 'Nombre duplicado',
          detail: `Ya existe un rol con el nombre "${this.roleLabel(formattedName)}" en el sistema`
        });
        this.loadingStore.hide();
        return;
      }
      finalName = formattedName;
    }

    this.roleService.actualizar(role.id, {
      name: finalName,
      companyId: effectiveCompanyId ?? undefined,
      permissionIds: Array.from(this.pendingPermIds()),
      menuIds: Array.from(this.pendingMenuIds())
    }).subscribe({
      next: (res) => {
        // Actualizar en la lista correcta
        if (this.activeSection() === 'empresa') {
          this.companyRoles.update(list => list.map(r => r.id === role.id ? res.data : r));
        } else {
          this.systemRoles.update(list => list.map(r => r.id === role.id ? res.data : r));
        }
        this.selectedRole.set(res.data);
        this.pendingPermIds.set(new Set(res.data.permissions.map(p => p.id)));
        this.pendingMenuIds.set(new Set(res.data.menuIds));
        this.isEditingName.set(false);
        this.editingNameValue.set('');
        this.messageService.add({ severity: 'success', summary: 'Guardado', detail: `Configuración de ${res.data.name} actualizada` });
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo guardar' });
        this.loadingStore.hide();
      }
    });
  }

  discard() {
    const role = this.selectedRole();
    if (!role) return;
    this.pendingPermIds.set(new Set(role.permissions.map(p => p.id)));
    this.pendingMenuIds.set(new Set(role.menuIds));
    this.isEditingName.set(false);
    this.editingNameValue.set('');
  }

  roleLabel(name: string): string {
    const map: Record<string, string> = {
      'ROLE_SUPER_ADMIN': 'Super Administrador',
      'ROLE_ADMIN': 'Administrador',
      'ROLE_VETERINARIO': 'Veterinario',
      'ROLE_RECEPCIONISTA': 'Recepcionista',
      'ROLE_CLIENTE': 'Cliente / Apoderado'
    };
    return map[name] ?? name.replace('ROLE_', '').replace(/_/g, ' ');
  }

  openCreateModal() {
    this.newRoleName.set('');
    this.showCreateModal.set(true);
  }

  closeCreateModal() {
    this.showCreateModal.set(false);
  }

  createRole() {
    if (!this.newRoleName().trim()) {
      this.messageService.add({ severity: 'warn', summary: 'Campo requerido', detail: 'El nombre del rol es obligatorio' });
      return;
    }

    let formattedName = this.newRoleName().trim().toUpperCase();
    if (!formattedName.startsWith('ROLE_')) {
      formattedName = 'ROLE_' + formattedName;
    }
    formattedName = formattedName.replace(/\s+/g, '_');

    // Validación en frontend para nombres duplicados
    const nameExists = [...this.companyRoles(), ...this.systemRoles()].some(
      r => r.name.toUpperCase() === formattedName
    );
    if (nameExists) {
      this.messageService.add({
        severity: 'error',
        summary: 'Nombre duplicado',
        detail: `Ya existe un rol con el nombre "${this.roleLabel(formattedName)}" en el sistema`
      });
      return;
    }

    const defaultPerm = this.allPermissions().find(p => p.name === 'USER_READ') || this.allPermissions()[0];
    const initialPermissions = defaultPerm ? [defaultPerm.id] : [];
    const section = this.activeSection();

    this.showCreateModal.set(false);
    this.confirmDialog.set({
      title: 'Crear nuevo rol',
      message: `¿Estás seguro de crear el rol "${this.roleLabel(formattedName)}"?`,
      variant: 'primary',
      onConfirm: () => {
        this.loadingStore.show();
        this.roleService.crear({
          name: formattedName,
          companyId: section === 'empresa' ? (this.activeCompanyId ?? undefined) : undefined,
          permissionIds: initialPermissions,
          menuIds: []
        }).subscribe({
          next: (res) => {
            if (section === 'empresa') {
              this.companyRoles.update(list => [...list, res.data]);
            } else {
              this.systemRoles.update(list => [...list, res.data]);
            }
            this.selectRole(res.data);
            this.messageService.add({ severity: 'success', summary: 'Creado', detail: `Rol ${this.roleLabel(res.data.name)} creado exitosamente` });
            this.loadingStore.hide();
          },
          error: (err) => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo crear el rol' });
            this.loadingStore.hide();
          }
        });
      }
    });
  }

  canDeleteRole(role: Role | null): boolean {
    if (!role) return false;
    if (!this.isAdminOrSuperAdmin()) return false;
    // Nunca permitir eliminar los roles centrales del sistema
    const protectedRoles = ['ROLE_SUPER_ADMIN', 'ROLE_ADMIN'];
    return !protectedRoles.includes(role.name);
  }

  deleteRole(role: Role) {
    this.confirmDialog.set({
      title: 'Eliminar Rol',
      message: `¿Estás seguro de que deseas eliminar el rol ${this.roleLabel(role.name)}? Esta acción no se puede deshacer y quitará este rol a cualquier empleado asignado.`,
      onConfirm: () => {
        this.loadingStore.show();
        this.roleService.eliminar(role.id).subscribe({
          next: () => {
            if (this.activeSection() === 'empresa') {
              this.companyRoles.update(list => list.filter(r => r.id !== role.id));
            } else {
              this.systemRoles.update(list => list.filter(r => r.id !== role.id));
            }
            this.selectedRole.set(null);
            this.messageService.add({ severity: 'success', summary: 'Eliminado', detail: 'Rol eliminado exitosamente' });
            this.loadingStore.hide();
          },
          error: (err) => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo eliminar el rol' });
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
    this.confirmDialog()?.onConfirm();
    this.confirmDialog.set(null);
  }
}
