import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthStore } from '../../store/auth.store';
import { DashboardService, DashboardStats } from '../../services/dashboard.service';
import { CompanyService } from '../../services/company.service';
import { DropdownModule } from 'primeng/dropdown';
import { FormsModule } from '@angular/forms';
import { Role } from '../../core/enums/role.enum';
import { LoadingStore } from '../../store/loading.store';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, DropdownModule, FormsModule, RouterModule],
  template: `
    <div class="min-h-screen bg-[#F8FAFC] pb-20">
      <!-- Header Seccion -->
      <div class="bg-white border-b border-slate-200/60 px-6 py-8 mb-8">
        <div class="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <p class="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em]">Sistema Activo</p>
            </div>
            <h1 class="text-3xl font-black text-slate-900 tracking-tight">
              Hola, <span class="text-[#0066AA]">{{ userName }}</span> 👋
            </h1>
            <p class="text-slate-500 text-sm mt-1 font-medium">Bienvenido al panel de gestión de VargasVet.</p>
          </div>

          <div class="flex items-center gap-4">
             <!-- Selector de Empresa para Super Admin -->
            <div *ngIf="isSuperAdmin" class="flex flex-col gap-1">
              <label class="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Vista de Sede</label>
              <p-dropdown 
                [options]="companies()" 
                [(ngModel)]="selectedCompanyId" 
                (onChange)="loadStats()"
                placeholder="Todas las sedes"
                styleClass="h-11 bg-slate-50 !border-none !rounded-xl !px-4 !flex !items-center !text-xs !font-bold !text-slate-700 shadow-sm min-w-[200px]"
                panelStyleClass="!rounded-xl !border-none !shadow-2xl">
              </p-dropdown>
            </div>

            <div class="h-12 w-[1px] bg-slate-200 hidden md:block"></div>

            <button (click)="logout()" 
              class="h-11 px-6 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10 flex items-center gap-2">
              <i class="pi pi-power-off"></i>
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>

      <div class="max-w-7xl mx-auto px-6">
        <!-- Stats Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          
          <!-- Card: Pacientes -->
          <div class="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm hover:shadow-md transition-all group">
            <div class="flex items-center justify-between mb-4">
              <div class="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                <i class="pi pi-users text-xl"></i>
              </div>
              <span class="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded-lg">Total</span>
            </div>
            <h3 class="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Pacientes</h3>
            <p class="text-3xl font-black text-slate-900">{{ stats()?.totalPacientes || 0 }}</p>
          </div>

          <!-- Card: Citas Hoy -->
          <div class="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm hover:shadow-md transition-all group">
            <div class="flex items-center justify-between mb-4">
              <div class="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                <i class="pi pi-calendar text-xl"></i>
              </div>
              <span class="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-1 rounded-lg">Hoy</span>
            </div>
            <h3 class="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Citas del Día</h3>
            <p class="text-3xl font-black text-slate-900">{{ stats()?.totalCitasHoy || 0 }}</p>
          </div>

          <!-- Card: Empleados -->
          <div class="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm hover:shadow-md transition-all group">
            <div class="flex items-center justify-between mb-4">
              <div class="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
                <i class="pi pi-briefcase text-xl"></i>
              </div>
              <span class="text-[10px] font-bold text-amber-500 bg-amber-50 px-2 py-1 rounded-lg">Activos</span>
            </div>
            <h3 class="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Personal</h3>
            <p class="text-3xl font-black text-slate-900">{{ stats()?.totalEmpleados || 0 }}</p>
          </div>

          <!-- Card: Empresas (Solo SuperAdmin) o Total Citas -->
          <div *ngIf="isSuperAdmin" class="bg-slate-900 p-6 rounded-[24px] border border-slate-800 shadow-xl shadow-slate-900/20 group">
            <div class="flex items-center justify-between mb-4">
              <div class="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                <i class="pi pi-building text-xl"></i>
              </div>
            </div>
            <h3 class="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Sedes Registradas</h3>
            <p class="text-3xl font-black text-white">{{ stats()?.totalEmpresas || 0 }}</p>
          </div>

          <div *ngIf="!isSuperAdmin" class="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm hover:shadow-md transition-all group">
            <div class="flex items-center justify-between mb-4">
              <div class="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
                <i class="pi pi-history text-xl"></i>
              </div>
              <span class="text-[10px] font-bold text-purple-500 bg-purple-50 px-2 py-1 rounded-lg">Global</span>
            </div>
            <h3 class="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Citas Totales</h3>
            <p class="text-3xl font-black text-slate-900">{{ stats()?.totalCitas || 0 }}</p>
          </div>

        </div>

        <!-- Main Content -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <!-- Seccion Izquierda: Accesos Rapidos -->
          <div class="lg:col-span-2 space-y-6">
            <div class="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
              <h2 class="text-xl font-black text-slate-900 mb-6 flex items-center gap-3">
                <i class="pi pi-bolt text-amber-500"></i>
                Acciones Rápidas
              </h2>
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <button routerLink="/admin/empleados" class="flex flex-col items-center p-6 rounded-2xl bg-slate-50 hover:bg-[#0066AA] hover:text-white transition-all group border border-slate-100">
                  <div class="w-10 h-10 rounded-xl bg-white flex items-center justify-center mb-3 shadow-sm group-hover:bg-white/20 group-hover:text-white text-slate-600">
                    <i class="pi pi-user-plus"></i>
                  </div>
                  <span class="text-[11px] font-black uppercase tracking-wider">Nuevo Empleado</span>
                </button>
                <button routerLink="/admin/clientes" class="flex flex-col items-center p-6 rounded-2xl bg-slate-50 hover:bg-[#0066AA] hover:text-white transition-all group border border-slate-100">
                  <div class="w-10 h-10 rounded-xl bg-white flex items-center justify-center mb-3 shadow-sm group-hover:bg-white/20 group-hover:text-white text-slate-600">
                    <i class="pi pi-users"></i>
                  </div>
                  <span class="text-[11px] font-black uppercase tracking-wider">Gestión Dueños</span>
                </button>
                <button routerLink="/citas" class="flex flex-col items-center p-6 rounded-2xl bg-slate-50 hover:bg-[#0066AA] hover:text-white transition-all group border border-slate-100">
                  <div class="w-10 h-10 rounded-xl bg-white flex items-center justify-center mb-3 shadow-sm group-hover:bg-white/20 group-hover:text-white text-slate-600">
                    <i class="pi pi-calendar-plus"></i>
                  </div>
                  <span class="text-[11px] font-black uppercase tracking-wider">Agendar Cita</span>
                </button>
              </div>
            </div>

            <!-- Panel de Permisos -->
            <div class="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
              <h2 class="text-xl font-black text-slate-900 mb-6 flex items-center gap-3">
                <i class="pi pi-shield text-emerald-500"></i>
                Tus Permisos
              </h2>
              <div class="flex flex-wrap gap-2">
                <span *ngFor="let perm of permissions" class="px-4 py-2 rounded-xl bg-slate-50 border border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  {{ perm }}
                </span>
              </div>
            </div>
          </div>

          <!-- Seccion Derecha: Info Lateral -->
          <div class="space-y-6">
            <div class="bg-gradient-to-br from-[#0066AA] to-[#004488] p-8 rounded-[32px] text-white shadow-xl shadow-blue-900/20">
              <div class="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-6">
                <i class="pi pi-info-circle text-2xl"></i>
              </div>
              <h2 class="text-xl font-black mb-3 italic">VargasVet Pro</h2>
              <p class="text-blue-100 text-sm leading-relaxed mb-6 font-medium">
                Estás utilizando la versión profesional para gestión clínica veterinaria multi-sede. 
              </p>
              <div class="pt-6 border-t border-white/10">
                <div class="flex items-center gap-3 text-xs font-bold">
                  <i class="pi pi-check-circle text-emerald-400"></i>
                  Soporte 24/7 Activo
                </div>
              </div>
            </div>

            <div class="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
              <h2 class="text-sm font-black text-slate-900 mb-4 uppercase tracking-[0.2em]">Soporte Técnico</h2>
              <p class="text-xs text-slate-500 font-medium mb-4 leading-relaxed">¿Necesitas ayuda con el sistema? Nuestro equipo está listo para apoyarte.</p>
              <button class="w-full py-4 rounded-2xl bg-slate-50 text-slate-900 text-[10px] font-black uppercase tracking-widest border border-slate-100 hover:bg-slate-100 transition-all">
                Enviar Ticket
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  `
})
export class DashboardComponent implements OnInit {
  private authStore = inject(AuthStore);
  private dashboardService = inject(DashboardService);
  private companyService = inject(CompanyService);
  private loadingStore = inject(LoadingStore);
  private router = inject(Router);

  userName = this.authStore.nombreCompleto() ?? '';
  roles = this.authStore.roles() ?? [];
  permissions = this.authStore.permissions() ?? [];
  isSuperAdmin = this.roles.includes(Role.SUPER_ADMIN);
  isAdmin = this.roles.includes(Role.ADMIN);

  stats = signal<DashboardStats | null>(null);
  companies = signal<any[]>([]);
  selectedCompanyId: number | null = null;

  ngOnInit() {
    if (this.isSuperAdmin) {
      this.loadCompanies();
    }
    this.loadStats();
  }

  loadCompanies() {
    this.companyService.listar(0, 1000).subscribe({
      next: (res) => {
        const list = res.data.content.map(c => ({ label: c.name, value: c.id }));
        this.companies.set([{ label: 'Todas las sedes', value: null }, ...list]);
      }
    });
  }

  loadStats() {
    this.loadingStore.show();
    this.dashboardService.getStats(this.selectedCompanyId || undefined).subscribe({
      next: (res) => {
        this.stats.set(res.data);
        this.loadingStore.hide();
      },
      error: () => {
        this.loadingStore.hide();
      }
    });
  }

  logout() {
    this.authStore.logout();
    this.router.navigate(['/login']);
  }
}
