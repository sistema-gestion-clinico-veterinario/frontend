import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  imports: [CommonModule, ToastModule],
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
  }

  selectRole(role: Role) {
    this.selectedRole.set(role);
    this.pendingPermIds.set(new Set(role.permissions.map(p => p.id)));
    this.pendingMenuIds.set(new Set(role.menuIds));
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
    if (!role) return false;
    return !this.setsEqual(new Set(role.permissions.map(p => p.id)), this.pendingPermIds()) ||
           !this.setsEqual(new Set(role.menuIds), this.pendingMenuIds());
  }
  private setsEqual(a: Set<number>, b: Set<number>): boolean {
    if (a.size !== b.size) return false;
    for (const v of a) if (!b.has(v)) return false;
    return true;
  }

  save() {
    const role = this.selectedRole();
    if (!role) return;
    this.loadingStore.show();
        const currentRole = this.selectedRole();
        const effectiveCompanyId = currentRole ? currentRole.companyId : this.activeCompanyId;
        this.roleService.actualizar(role.id, {
          name: role.name,
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
}
