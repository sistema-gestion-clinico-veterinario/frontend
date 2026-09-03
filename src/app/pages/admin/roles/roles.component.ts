import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { SkeletonModule } from 'primeng/skeleton';
import { RoleService, RolVentanaPermiso } from '../../../core/services/role.service';
import { LoadingStore } from '../../../store/loading.store';
import { AuthStore } from '../../../store/auth.store';
import { AuthService } from '../../../core/services/auth.service';
import { Role } from '../../../models/response/permission';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { resolveInitialRoute } from '../../../layouts/main-layout/navbar/navbar.component';
import { hasMeaningfulText } from '../../../core/utils/input-validation.util';
import { normalizeText } from '../../../core/utils/normalize-text.util';
import { SessionService } from '../../../core/services/session.service';

type Section = 'empresa' | 'sistema';

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [CommonModule, ToastModule, FormsModule, NgTemplateOutlet, RouterLink, SkeletonModule, HasPermissionDirective],
  providers: [MessageService],
  templateUrl: './roles.component.html',
  styleUrl: './roles.component.scss'
})
export class RolesComponent implements OnInit {
  private readonly roleService = inject(RoleService);
  private readonly messageService = inject(MessageService);
  private readonly authStore = inject(AuthStore);
  private readonly authService = inject(AuthService);
  private readonly sessionService = inject(SessionService);
  private readonly router = inject(Router);
  readonly loadingStore = inject(LoadingStore);

  isSuperAdmin = computed(() => this.authStore.isSuperAdmin());
  isAdminOrSuperAdmin = computed(() => this.authStore.hasAccess('VISTA_ROLES', 'escribir'));

  hasModifyAccess = computed(() => {
    return this.authStore.hasAccess('VISTA_ROLES', 'modificar');
  });

  get activeCompanyId(): number | null {
    return this.authStore.selectedEnterprise()?.establishmentId ?? this.authStore.companyId();
  }

  companyRoles        = signal<Role[]>([]);
  cargando            = signal<boolean>(true);
  systemRoles         = signal<Role[]>([]);
  selectedRole        = signal<Role | null>(null);
  activeSection       = signal<Section>('empresa');
  ventanaPermisos     = signal<RolVentanaPermiso[]>([]);
  permisosModificados = signal<boolean>(false);
  loadingPermisos     = signal<boolean>(false);
  showCreateModal     = signal<boolean>(false);
  newRoleName         = signal<string>('');
  newRoleDesc         = signal<string>('');
  newRoleScope        = signal<'STAFF' | 'CLIENT'>('STAFF');
  confirmDialog       = signal<{ title: string; message: string; onConfirm: () => void; variant?: 'danger' | 'primary' } | null>(null);
  isEditingName       = signal<boolean>(false);
  editingNameValue    = signal<string>('');
  editingDescValue    = signal<string>('');

  ngOnInit() {
    const activeId = this.authStore.selectedEnterprise()?.establishmentId
                  ?? this.authStore.companyId();
    this.loadCompanyRoles(activeId);

    if (this.isSuperAdmin()) {
      this.roleService.listarSistema().subscribe({
        next: (res) => {
          this.systemRoles.set(res.data);
          this.cargando.set(false);
        },
        error: () => {
          this.cargando.set(false);
        }
      });
    } else {
      this.cargando.set(false);
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
    this.cargando.set(true);
    this.roleService.listarPorEmpresa(companyId).subscribe({
      next: (res) => {
        this.companyRoles.set(res.data);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
      }
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
      next: (res) => {
        if (this.selectedRole()?.id !== roleId) return;
        this.ventanaPermisos.set(res.data);
        this.loadingPermisos.set(false);
      },
      error: () => {
        if (this.selectedRole()?.id === roleId) this.loadingPermisos.set(false);
      }
    });
  }

  isSuperAdminRole(role: Role | null): boolean {
    return role?.purpose === 'PLATFORM_ADMIN';
  }

  rootVentanas(): RolVentanaPermiso[] {
    return this.ventanaPermisos().filter(v => v.parentId === null);
  }

  childrenOf(parentCodigo: string): RolVentanaPermiso[] {
    return this.ventanaPermisos().filter(v => v.parentCodigo === parentCodigo);
  }

  togglePermiso(v: RolVentanaPermiso, campo: 'leer' | 'escribir' | 'modificar' | 'eliminar') {
    const nuevoValor = !v[campo];
    this.ventanaPermisos.update(list =>
      list.map(item => {
        if (item.ventanaId === v.ventanaId) {
          if (campo === 'leer' && !nuevoValor) {
            return { ...item, leer: false, escribir: false, modificar: false, eliminar: false };
          }
          if (campo !== 'leer' && nuevoValor && !item.leer) {
            return { ...item, leer: true, [campo]: true };
          }
          return { ...item, [campo]: nuevoValor };
        }
        return item;
      })
    );
    this.permisosModificados.set(true);
    if (campo !== 'leer' && nuevoValor && !v.leer) {
      this.messageService.add({ severity: 'info', summary: 'Permiso Ver requerido', detail: `Se activó "Ver" automáticamente, ya que "Crear/Editar/Eliminar" lo requieren.` });
    }
  }

  savePermisos() {
    const role = this.selectedRole();
    if (!role) return;
    if (!role.activo) {
      this.messageService.add({ severity: 'error', summary: 'Rol inactivo', detail: 'No se pueden asignar permisos a un rol inactivo' });
      return;
    }
    this.confirmDialog.set({
      title: 'Guardar permisos',
      message: `¿Guardar los cambios de permisos para el rol "${this.roleLabel(role.name)}"?`,
      variant: 'primary',
      onConfirm: () => {
        this.confirmDialog.set(null);
        this.roleService.saveVentanas(role.id, role.permissionVersion, this.ventanaPermisos()).subscribe({
          next: (res) => {
            this.ventanaPermisos.set(res.data);
            this.updatePermissionVersion(role.id, role.permissionVersion + 1);
            this.permisosModificados.set(false);
            this.messageService.add({ severity: 'success', summary: 'Guardado', detail: 'Permisos actualizados correctamente' });
            this.refreshCurrentSessionIfActiveRoleChanged(role.id);
          },
          error: (err) => {
            const conflict = err.status === 409;
            this.messageService.add({
              severity: conflict ? 'warn' : 'error',
              summary: conflict ? 'Cambios concurrentes' : 'Error',
              detail: conflict
                ? 'Otro administrador modificó este rol. Se cargará la versión vigente para evitar sobrescribir sus cambios.'
                : (err.error?.message || 'No se pudo guardar'),
              sticky: conflict
            });
            if (conflict) this.reloadRoleAfterConflict(role);
          }
        });
      }
    });
  }

  private updatePermissionVersion(roleId: number, permissionVersion: number) {
    const update = (roles: Role[]) => roles.map(role =>
      role.id === roleId ? { ...role, permissionVersion } : role
    );
    this.companyRoles.update(update);
    this.systemRoles.update(update);
    this.selectedRole.update(role =>
      role?.id === roleId ? { ...role, permissionVersion } : role
    );
  }

  private reloadRoleAfterConflict(staleRole: Role) {
    const request = staleRole.companyId == null
      ? this.roleService.listarSistema()
      : this.roleService.listarPorEmpresa(staleRole.companyId);

    request.subscribe({
      next: ({ data: roles }) => {
        if (staleRole.companyId == null) this.systemRoles.set(roles);
        else this.companyRoles.set(roles);

        const currentRole = roles.find(role => role.id === staleRole.id) ?? null;
        this.selectedRole.set(currentRole);
        this.permisosModificados.set(false);
        if (currentRole) this.loadVentanaPermisos(currentRole.id);
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
    return this.hasModifyAccess();
  }

  canRenameRole(role: Role | null): boolean {
    if (!role) return false;
    return this.hasModifyAccess();
  }

  setDataScope(v: RolVentanaPermiso, dataScope: 'OWN' | 'COMPANY') {
    this.ventanaPermisos.update(list =>
      list.map(item => item.ventanaId === v.ventanaId ? { ...item, dataScope } : item)
    );
    this.permisosModificados.set(true);
  }

  canToggleRole(role: Role | null): boolean {
    return !!role && this.hasModifyAccess() && !role.protectedRole;
  }

  startEditName() {
    const role = this.selectedRole();
    if (!role) return;
    const cleanName = role.name.startsWith('ROLE_') ? role.name.substring(5) : role.name;
    this.editingNameValue.set(cleanName);
    this.editingDescValue.set(role.descripcion ?? '');
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
    if (!this.isValidRoleName(formattedName)) {
      this.messageService.add({ severity: 'warn', summary: 'Nombre invalido', detail: 'Use solo letras, numeros y guion bajo; minimo 2 caracteres.' });
      return;
    }

    const nameExists = this.activeSection() === 'empresa'
      ? this.companyRoles().some(r => r.id !== role.id && r.name.toUpperCase() === formattedName)
      : this.systemRoles().some(r => r.id !== role.id && r.name.toUpperCase() === formattedName);
    if (nameExists) {
      this.messageService.add({ severity: 'error', summary: 'Nombre duplicado', detail: 'Ya existe un rol con ese nombre en esta empresa' });
      return;
    }

    this.confirmDialog.set({
      title: 'Guardar cambios',
      message: `¿Guardar cambios en el rol "${this.roleLabel(role.name)}"?`,
      variant: 'primary',
      onConfirm: () => {
        const descripcion = normalizeText(this.editingDescValue()) || undefined;
        if (descripcion && !hasMeaningfulText(descripcion)) {
          this.messageService.add({ severity: 'warn', summary: 'Descripcion invalida', detail: 'La descripcion debe contener texto real y no usar caracteres peligrosos.' });
          return;
        }
        this.roleService.actualizar(role.id, {
          name: formattedName,
          descripcion,
          companyId: role.companyId ?? undefined,
          scope: role.scope
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
          },
          error: (err) => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo guardar' });
          }
        });
      }
    });
  }

  discard() {
    this.isEditingName.set(false);
    this.editingNameValue.set('');
    this.editingDescValue.set('');
  }

  isDirty(): boolean {
    const role = this.selectedRole();
    if (!role || !this.canEditRole(role)) return false;
    if (!this.isEditingName()) return false;
    let formattedName = this.editingNameValue().trim().toUpperCase();
    if (!formattedName.startsWith('ROLE_')) formattedName = 'ROLE_' + formattedName;
    formattedName = formattedName.replace(/\s+/g, '_');
    const nameChanged = formattedName !== role.name;
    const descChanged = this.editingDescValue().trim() !== (role.descripcion ?? '');
    return nameChanged || descChanged;
  }

  roleLabel(name: string): string {
    return name.replace(/^ROLE_/, '').replaceAll('_', ' ');
  }

  openCreateModal() {
    this.newRoleName.set('');
    this.newRoleDesc.set('');
    this.newRoleScope.set('STAFF');
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
    if (!this.isValidRoleName(formattedName)) {
      this.messageService.add({ severity: 'warn', summary: 'Nombre invalido', detail: 'Use solo letras, numeros y guion bajo; minimo 2 caracteres.' });
      return;
    }
    const descripcion = normalizeText(this.newRoleDesc());
    if (descripcion.length > 250) {
      this.messageService.add({ severity: 'warn', summary: 'Descripcion extensa', detail: 'La descripcion no debe superar 250 caracteres.' });
      return;
    }
    if (descripcion && !hasMeaningfulText(descripcion)) {
      this.messageService.add({ severity: 'warn', summary: 'Descripcion invalida', detail: 'La descripcion debe contener texto real y no usar caracteres peligrosos.' });
      return;
    }

    const section = this.activeSection();
    const nameExists = section === 'empresa'
      ? this.companyRoles().some(r => r.name.toUpperCase() === formattedName)
      : this.systemRoles().some(r => r.name.toUpperCase() === formattedName);
    if (nameExists) {
      this.messageService.add({ severity: 'error', summary: 'Nombre duplicado', detail: 'Ya existe un rol con ese nombre' });
      return;
    }

    if (section === 'empresa' && !this.activeCompanyId) {
      this.messageService.add({ severity: 'warn', summary: 'Sin empresa seleccionada', detail: 'Selecciona una empresa antes de crear un rol empresarial.' });
      return;
    }
    this.showCreateModal.set(false);
    this.confirmDialog.set({
      title: 'Crear nuevo rol',
      message: `¿Crear el rol "${this.roleLabel(formattedName)}"?`,
      variant: 'primary',
      onConfirm: () => {
        this.roleService.crear({
          name: formattedName,
          descripcion: descripcion || undefined,
          companyId: section === 'empresa' ? (this.activeCompanyId ?? undefined) : undefined,
          scope: section === 'empresa' ? this.newRoleScope() : 'PLATFORM'
        }).subscribe({
          next: (res) => {
            if (section === 'empresa') {
              this.companyRoles.update(list => [...list, res.data]);
            } else {
              this.systemRoles.update(list => [...list, res.data]);
            }
            this.selectRole(res.data);
            this.messageService.add({ severity: 'success', summary: 'Creado', detail: 'Rol creado exitosamente' });
          },
          error: (err) => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo crear el rol' });
          }
        });
      }
    });
  }

  toggleActivo(role: Role) {
    const accion = role.activo ? 'desactivar' : 'activar';
    this.confirmDialog.set({
      title: `Confirmar ${accion}`,
      variant: role.activo ? 'danger' : 'primary',
      message: role.activo
        ? `¿Estás seguro de desactivar el rol "${this.roleLabel(role.name)}"? Los usuarios con este rol no podrán acceder al sistema.`
        : `¿Estás seguro de activar el rol "${this.roleLabel(role.name)}"?`,
      onConfirm: () => {
        this.confirmDialog.set(null);
        this.roleService.toggleActivo(role.id).subscribe({
          next: (res) => {
            const updated = res.data;
            if (this.activeSection() === 'empresa') {
              this.companyRoles.update(list => list.map(r => r.id === role.id ? updated : r));
            } else {
              this.systemRoles.update(list => list.map(r => r.id === role.id ? updated : r));
            }
            this.selectedRole.set(updated);
            this.messageService.add({
              severity: updated.activo ? 'success' : 'warn',
              summary: updated.activo ? 'Rol activado' : 'Rol desactivado',
              detail: `El rol "${this.roleLabel(updated.name)}" fue ${updated.activo ? 'activado' : 'desactivado'}`
            });
          },
          error: () => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cambiar el estado del rol' });
          }
        });
      }
    });
  }

  canDeleteRole(role: Role | null): boolean {
    if (!role) return false;
    return this.hasModifyAccess() && !role.protectedRole;
  }

  deleteRole(role: Role) {
    this.confirmDialog.set({
      title: 'Eliminar Rol',
      message: `¿Eliminar el rol ${this.roleLabel(role.name)}? Esta acción no se puede deshacer.`,
      onConfirm: () => {
        this.roleService.eliminar(role.id).subscribe({
          next: () => {
            if (this.activeSection() === 'empresa') {
              this.companyRoles.update(list => list.filter(r => r.id !== role.id));
            } else {
              this.systemRoles.update(list => list.filter(r => r.id !== role.id));
            }
            this.selectedRole.set(null);
            this.messageService.add({ severity: 'success', summary: 'Eliminado', detail: 'Rol eliminado exitosamente' });
          },
          error: (err) => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo eliminar el rol' });
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

  private refreshCurrentSessionIfActiveRoleChanged(roleId: number) {
    if (this.authStore.activeRoleId() !== roleId) {
      return;
    }

    this.authService.refreshToken().subscribe({
      next: ({ data }) => {
        this.sessionService.establish(data, true);

        if (!this.authStore.hasRouteAccess(this.router.url)) {
          this.router.navigateByUrl(resolveInitialRoute(data.menu ?? [], data.activeRolePurpose), { replaceUrl: true });
        }
      },
      error: () => {}
    });
  }

  private isValidRoleName(name: string): boolean {
    return /^ROLE_[A-Z_Ñ]{2,60}$/.test(name);
  }
}
