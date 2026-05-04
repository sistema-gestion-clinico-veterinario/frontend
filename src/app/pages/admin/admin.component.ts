import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '../../store/auth.store';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-slate-50 py-10 text-slate-900">
      <div class="mx-auto max-w-5xl px-6">
        <div class="rounded-[32px] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50">
          <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p class="text-sm uppercase tracking-[0.3em] text-emerald-500">Administración</p>
              <h1 class="text-4xl font-semibold">Panel de administración</h1>
            </div>
            <button
              class="rounded-3xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              (click)="logout()"
            >Cerrar sesión</button>
          </div>
          <p class="mt-4 text-slate-600">Solo los usuarios con rol administrador pueden acceder a esta sección.</p>
          <div class="mt-8 grid gap-4 sm:grid-cols-2">
            <div class="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <h2 class="text-xl font-semibold">Gestión de usuarios</h2>
              <p class="mt-2 text-slate-600">Crea, edita y asigna permisos a los usuarios del sistema.</p>
            </div>
            <div class="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <h2 class="text-xl font-semibold">Configuración de empresa</h2>
              <p class="mt-2 text-slate-600">Actualiza datos de la empresa y controla accesos globales.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class AdminComponent {
  private authStore = inject(AuthStore);
  private router = inject(Router);

  logout() {
    this.authStore.logout();
    this.router.navigate(['/login']);
  }
}
