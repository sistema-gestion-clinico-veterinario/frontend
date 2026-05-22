import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { RoleService, RolVentanaPermiso } from '../../../core/services/role.service';
import { LoadingStore } from '../../../store/loading.store';
import { AuthStore } from '../../../store/auth.store';
import { Role } from '../../../models/response/permission';

type Section = 'empresa' | 'sistema';

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [CommonModule, ToastModule, FormsModule, NgTemplateOutlet],
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

  companyRoles        = signal<Role[]>([]);
  systemRoles         = signal<Role[]>([]);
  selectedRole        = signal<Role | null>(null);
  activeSection       = signal<Section>('empresa');
  ventanaPermisos     = signal<RolVentanaPermiso[]>([]);
  permisosModificados = signal<boolean>(false);
  loadingPermisos     = signal<boolean>(false);
  showCreateModal     = signal<boolean>(false);
  newRoleName         = signal<string>('');
  newRoleDesc         = signal<string>('');
  confirmDialog       = signal<{ title: string; message: string; onConfirm: () => void; variant?: 'danger' | 'primary' } | null>(null);
  isEditingName       = signal<boolean>(false);
  editingNameValue    = signal<string>('');

  ngOnInit() {
    const activeId = this.authStore.selectedEnterprise()?.establishmentId
                  ?? this.authStore.companyId();
    this.loadCompanyRoles(activeId);

    if (this.isSuperAdmin()) {
      this.roleService.listarSistema().subscribe({
        next: (res) => this.systemRoles.set(res.data),
        error: () => {}
      });
    }
  }

  /**
   * Llamar este método desde el navbar cuando el superadmin cambia de empresa.
   * El navbar ya tiene su propio mecanismo de selectCompany(); si necesitas
   * refrescar los roles al cambiar empresa, emite un evento desde el navbar
   * y suscríbete aquí a un servicio compartido (ej. CompanyChangeService).
   */
  reloadForCompany(companyId: number) {
    this.selectedRole.set(null);
    this.ventanaPermisos.set([]);
    this.permisosModificados.set(false);
    this.loadCompanyRoles(companyId);
  }

  loadCompanyRoles(companyId: number | null | undefined) {
    if (!companyId) {
      this.companyRoles.set([]);
      return;
    }
    this.roleService.listarPorEmpresa(companyId).subscribe({
      next: (res) => this.companyRoles.set(res.data),
      error: () => {}
    });
  }

  setSection(s: Section) {
    this.activeSection.set(s);
    this.selectedRole.set(null);
    this.isEditingName.set(false);
    this.editingNameValue.set('');
  }

  selectRole(role: Role) {
    this.selectedRole.set(role);
    this.isEditingName.set(false);
    this.editingNameValue.set('');
    this.permisosModificados.set(false);
    this.loadVentanaPermisos(role.id);
  }

  loadVentanaPermisos(roleId: number) {
    this.loadingPermisos.set(true);
    this.roleService.getVentanas(roleId).subscribe({
      next: (res) => { this.ventanaPermisos.set(res.data); this.loadingPermisos.set(false); },
      error: () => this.loadingPermisos.set(false)
    });
  }

  isSuperAdminRole(role: Role | null): boolean {
    return role?.name === 'ROLE_SUPER_ADMIN';
  }

  rootVentanas(): RolVentanaPermiso[] {
    return this.ventanaPermisos().filter(v => v.parentId === null);
  }

  childrenOf(parentCodigo: string): RolVentanaPermiso[] {
    return this.ventanaPermisos().filter(v => v.parentCodigo === parentCodigo);
  }

  togglePermiso(v: RolVentanaPermiso, campo: 'leer' | 'escribir' | 'modificar' | 'eliminar') {
    this.ventanaPermisos.update(list =>
      list.map(item => item.ventanaId === v.ventanaId ? { ...item, [campo]: !item[campo] } : item)
    );
    this.permisosModificados.set(true);
  }

  toggleLeerActiva(v: RolVentanaPermiso, checked: boolean) {
    this.ventanaPermisos.update(list =>
      list.map(item => {
        if (item.ventanaId === v.ventanaId) {
          return {
            ...item,
            leer: checked,
            escribir:  checked ? item.escribir  : false,
            modificar: checked ? item.modificar : false,
            eliminar:  checked ? item.eliminar  : false
          };
        }
        return item;
      })
    );
    this.permisosModificados.set(true);
  }

  savePermisos() {
    const role = this.selectedRole();
    if (!role) return;
    this.loadingStore.show();
    this.roleService.saveVentanas(role.id, this.ventanaPermisos()).subscribe({
      next: (res) => {
        this.ventanaPermisos.set(res.data);
        this.permisosModificados.set(false);
        this.messageService.add({ severity: 'success', summary: 'Guardado', detail: 'Permisos actualizados correctamente' });
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo guardar' });
        this.loadingStore.hide();
      }
    });
  }

  discardPermisos() {
    const role = this.selectedRole();
    if (role) this.loadVentanaPermisos(role.id);
    this.permisosModificados.set(false);
  }

  getPermiso(v: RolVentanaPermiso, campo: string): boolean {
    return (v as any)[campo] ?? false;
  }

  canEditRole(role: Role | null): boolean {
    if (!role) return false;
    return this.isAdminOrSuperAdmin();
  }

  canRenameRole(role: Role | null): boolean {
    if (!role) return false;
    if (!this.isAdminOrSuperAdmin()) return false;
    const protectedRoles = ['ROLE_SUPER_ADMIN', 'ROLE_ADMIN'];
    return !protectedRoles.includes(role.name);
  }

  startEditName() {
    const role = this.selectedRole();
    if (!role) return;
    const cleanName = role.name.startsWith('ROLE_') ? role.name.substring(5) : role.name;
    this.editingNameValue.set(cleanName);
    this.isEditingName.set(true);
  }

  cancelEditName() {
    this.isEditingName.set(false);
    this.editingNameValue.set('');
  }

  save() {
    const role = this.selectedRole();
    if (!role || !this.isEditingName()) return;

    let formattedName = this.editingNameValue().trim().toUpperCase();
    if (!formattedName.startsWith('ROLE_')) formattedName = 'ROLE_' + formattedName;
    formattedName = formattedName.replace(/\s+/g, '_');

    const nameExists = [...this.companyRoles(), ...this.systemRoles()].some(
      r => r.id !== role.id && r.name.toUpperCase() === formattedName
    );
    if (nameExists) {
      this.messageService.add({ severity: 'error', summary: 'Nombre duplicado', detail: 'Ya existe un rol con ese nombre' });
      return;
    }

    this.confirmDialog.set({
      title: 'Guardar cambios',
      message: `¿Guardar cambios en el rol "${this.roleLabel(role.name)}"?`,
      variant: 'primary',
      onConfirm: () => {
        this.loadingStore.show();
        this.roleService.actualizar(role.id, {
          name: formattedName,
          descripcion: role.descripcion,
          companyId: role.companyId ?? undefined
        }).subscribe({
          next: (res) => {
            if (this.activeSection() === 'empresa') {
              this.companyRoles.update(list => list.map(r => r.id === role.id ? res.data : r));
            } else {
              this.systemRoles.update(list => list.map(r => r.id === role.id ? res.data : r));
            }
            this.selectedRole.set(res.data);
            this.isEditingName.set(false);
            this.editingNameValue.set('');
            this.messageService.add({ severity: 'success', summary: 'Guardado', detail: 'Rol actualizado correctamente' });
            this.loadingStore.hide();
          },
          error: (err) => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo guardar' });
            this.loadingStore.hide();
          }
        });
      }
    });
  }

  discard() {
    this.isEditingName.set(false);
    this.editingNameValue.set('');
  }

  isDirty(): boolean {
    const role = this.selectedRole();
    if (!role || !this.canEditRole(role)) return false;
    if (!this.isEditingName()) return false;
    let formattedName = this.editingNameValue().trim().toUpperCase();
    if (!formattedName.startsWith('ROLE_')) formattedName = 'ROLE_' + formattedName;
    formattedName = formattedName.replace(/\s+/g, '_');
    return formattedName !== role.name;
  }

  roleLabel(name: string): string {
    const map: Record<string, string> = {
      'ROLE_SUPER_ADMIN': 'Super Administrador',
      'ROLE_ADMIN': 'Administrador',
      'ROLE_VETERINARIO': 'Veterinario',
      'ROLE_RECEPCIONISTA': 'Recepcionista',
      'ROLE_CLIENTE': 'Cliente / Apoderado',
      'ROLE_APODERADO': 'Cliente / Apoderado'
    };
    return map[name] ?? name.replace('ROLE_', '').replace(/_/g, ' ');
  }

  openCreateModal() {
    this.newRoleName.set('');
    this.newRoleDesc.set('');
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
    if (!formattedName.startsWith('ROLE_')) formattedName = 'ROLE_' + formattedName;
    formattedName = formattedName.replace(/\s+/g, '_');

    const nameExists = [...this.companyRoles(), ...this.systemRoles()].some(
      r => r.name.toUpperCase() === formattedName
    );
    if (nameExists) {
      this.messageService.add({ severity: 'error', summary: 'Nombre duplicado', detail: 'Ya existe un rol con ese nombre' });
      return;
    }

    const section = this.activeSection();
    this.showCreateModal.set(false);
    this.confirmDialog.set({
      title: 'Crear nuevo rol',
      message: `¿Crear el rol "${this.roleLabel(formattedName)}"?`,
      variant: 'primary',
      onConfirm: () => {
        this.loadingStore.show();
        this.roleService.crear({
          name: formattedName,
          descripcion: this.newRoleDesc() || undefined,
          companyId: section === 'empresa' ? (this.activeCompanyId ?? undefined) : undefined
        }).subscribe({
          next: (res) => {
            if (section === 'empresa') {
              this.companyRoles.update(list => [...list, res.data]);
            } else {
              this.systemRoles.update(list => [...list, res.data]);
            }
            this.selectRole(res.data);
            this.messageService.add({ severity: 'success', summary: 'Creado', detail: 'Rol creado exitosamente' });
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
    const protectedRoles = ['ROLE_SUPER_ADMIN', 'ROLE_ADMIN'];
    return !protectedRoles.includes(role.name);
  }

  deleteRole(role: Role) {
    this.confirmDialog.set({
      title: 'Eliminar Rol',
      message: `¿Eliminar el rol ${this.roleLabel(role.name)}? Esta acción no se puede deshacer.`,
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