import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '../../store/auth.store';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-slate-50 py-10 text-slate-900">
      <div class="mx-auto max-w-6xl px-6">
        <div class="mb-8 flex flex-col gap-4 rounded-[32px] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p class="text-sm uppercase tracking-[0.3em] text-sky-500">Bienvenido</p>
              <h1 class="text-4xl font-semibold">Hola, {{ userName || 'Usuario' }}</h1>
            </div>
            <button
              class="rounded-3xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              (click)="logout()"
            >
              Cerrar sesión
            </button>
          </div>
          <p class="max-w-2xl text-slate-600">Estas son las vistas y acciones disponibles según tu perfil y permisos.</p>
        </div>

        <div class="grid gap-6 lg:grid-cols-2">
          <div *ngIf="isVeterinario" class="rounded-[32px] border border-sky-200 bg-sky-50 p-8 shadow-sm">
            <h2 class="text-2xl font-semibold text-slate-900">Panel Veterinario</h2>
            <p class="mt-3 text-slate-600">Accede a citas, mascotas y registros clínicos según tus permisos.</p>
            <div class="mt-6 grid gap-3">
              <span class="inline-flex items-center rounded-full bg-white px-4 py-2 text-sm text-slate-700 shadow-sm">Agenda</span>
              <span class="inline-flex items-center rounded-full bg-white px-4 py-2 text-sm text-slate-700 shadow-sm">Mascotas</span>
              <span class="inline-flex items-center rounded-full bg-white px-4 py-2 text-sm text-slate-700 shadow-sm">Historias clínicas</span>
            </div>
          </div>

          <div *ngIf="isAdmin" class="rounded-[32px] border border-emerald-200 bg-emerald-50 p-8 shadow-sm">
            <h2 class="text-2xl font-semibold text-slate-900">Administración</h2>
            <p class="mt-3 text-slate-600">Gestiona usuarios, permisos y la información de la empresa.</p>
            <div class="mt-6 grid gap-3">
              <span class="inline-flex items-center rounded-full bg-white px-4 py-2 text-sm text-slate-700 shadow-sm">Usuarios</span>
              <span class="inline-flex items-center rounded-full bg-white px-4 py-2 text-sm text-slate-700 shadow-sm">Permisos</span>
              <span class="inline-flex items-center rounded-full bg-white px-4 py-2 text-sm text-slate-700 shadow-sm">Empresa</span>
            </div>
          </div>
        </div>

        <div class="mt-6 rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
          <h2 class="text-2xl font-semibold text-slate-900">Permisos asignados</h2>
          <div class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <span *ngFor="let permission of permissions" class="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
              {{ permission }}
            </span>
          </div>
        </div>
      </div>
    </div>
  `
})
export class DashboardComponent {
  private authStore = inject(AuthStore);
  private router = inject(Router);

  userName = this.authStore.nombreCompleto() ?? '';
  roles = this.authStore.roles() ?? [];
  permissions = this.authStore.permissions() ?? [];
  isVeterinario = this.roles.includes('ROLE_VETERINARIO');
  isAdmin = this.roles.includes('ROLE_ADMIN');

  logout() {
    this.authStore.logout();
    this.router.navigate(['/login']);
  }
}
