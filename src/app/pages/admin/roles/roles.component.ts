import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { RoleService } from '../../../core/services/role.service';
import { LoadingStore } from '../../../store/loading.store';
import { Permission as PermissionModel, Role } from '../../../models/response/permission';

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
  readonly loadingStore = inject(LoadingStore);

  roles = signal<Role[]>([]);
  allPermissions = signal<PermissionModel[]>([]);
  selectedRole = signal<Role | null>(null);
  pendingIds = signal<Set<number>>(new Set());

  readonly modules = computed(() => {
    const map = new Map<string, PermissionModel[]>();
    for (const p of this.allPermissions()) {
      const list = map.get(p.module) ?? [];
      list.push(p);
      map.set(p.module, list);
    }
    return map;
  });

  readonly PROTECTED_ROLES = ['ROLE_SUPER_ADMIN', 'ROLE_CLIENTE'];

  ngOnInit() {
    this.loadingStore.show();
    this.roleService.listar().subscribe({
      next: (res) => {
        this.roles.set(res.data.filter(r => !this.PROTECTED_ROLES.includes(r.name)));
        this.loadingStore.hide();
      },
      error: () => this.loadingStore.hide()
    });

    this.roleService.listarPermisos().subscribe({
      next: (res) => this.allPermissions.set(res.data)
    });
  }

  selectRole(role: Role) {
    this.selectedRole.set(role);
    this.pendingIds.set(new Set(role.permissions.map(p => p.id)));
  }

  togglePermission(id: number) {
    const current = new Set(this.pendingIds());
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    this.pendingIds.set(current);
  }

  hasPermission(id: number): boolean {
    return this.pendingIds().has(id);
  }

  isDirty(): boolean {
    const role = this.selectedRole();
    if (!role) return false;
    const original = new Set(role.permissions.map(p => p.id));
    const pending = this.pendingIds();
    if (original.size !== pending.size) return true;
    for (const id of pending) {
      if (!original.has(id)) return true;
    }
    return false;
  }

  save() {
    const role = this.selectedRole();
    if (!role) return;

    this.loadingStore.show();
    this.roleService.actualizar(role.id, {
      name: role.name,
      permissionIds: Array.from(this.pendingIds())
    }).subscribe({
      next: (res) => {
        this.roles.update(list => list.map(r => r.id === role.id ? res.data : r));
        this.selectedRole.set(res.data);
        this.pendingIds.set(new Set(res.data.permissions.map(p => p.id)));
        this.messageService.add({ severity: 'success', summary: 'Guardado', detail: `Permisos de ${res.data.name} actualizados` });
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
    if (role) this.pendingIds.set(new Set(role.permissions.map(p => p.id)));
  }

  roleLabel(name: string): string {
    const map: Record<string, string> = {
      'ROLE_ADMIN': 'Administrador',
      'ROLE_VETERINARIO': 'Veterinario',
      'ROLE_RECEPCIONISTA': 'Recepcionista'
    };
    return map[name] ?? name;
  }
}
