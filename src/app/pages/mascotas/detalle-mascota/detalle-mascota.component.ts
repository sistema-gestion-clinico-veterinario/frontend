import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, of, switchMap } from 'rxjs';

import { HistoriaClinicaService } from '../../../core/services/historia-clinica.service';
import { MascotaService } from '../../../core/services/mascota.service';
import { MediaService } from '../../../core/services/media.service';
import { HistoriaClinicaDetalle } from '../../../models/response/historia-clinica-response';
import { MascotaResponse } from '../../../models/response/mascota-response';
import { AuthStore } from '../../../store/auth.store';

@Component({
  selector: 'app-detalle-mascota',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './detalle-mascota.component.html',
  styleUrl: './detalle-mascota.component.scss'
})
export class DetalleMascotaComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly mascotaService = inject(MascotaService);
  private readonly historiaService = inject(HistoriaClinicaService);
  private readonly authStore = inject(AuthStore);
  readonly mediaService = inject(MediaService);

  readonly mascota = signal<MascotaResponse | null>(null);
  readonly historia = signal<HistoriaClinicaDetalle | null>(null);
  readonly cargando = signal(true);
  readonly errorCarga = signal(false);
  readonly seccionActiva = signal<'historial' | 'preventivos' | 'vacunas' | 'recetas' | 'documentos' | 'datos'>('historial');

  readonly consultasRecientes = computed(() => [...(this.historia()?.consultas ?? [])]
    .sort((a, b) => new Date(b.fechaConsulta).getTime() - new Date(a.fechaConsulta).getTime())
    .slice(0, 5));
  readonly ultimaConsulta = computed(() => this.consultasRecientes()[0] ?? null);
  readonly notaClinica = computed(() => {
    const consulta = this.ultimaConsulta();
    return consulta?.observaciones || consulta?.anamnesis || null;
  });
  readonly aplicacionesRecientes = computed(() => [...(this.historia()?.aplicacionesPreventivas ?? [])]
    .sort((a, b) => new Date(b.fechaAplicacion).getTime() - new Date(a.fechaAplicacion).getTime())
    .slice(0, 4));
  readonly controlesPendientes = computed(() => [...(this.historia()?.controlesPreventivos ?? [])]
    .filter(control => !['APLICADO', 'CANCELADO'].includes(control.estado))
    .sort((a, b) => new Date(a.fechaRecomendada).getTime() - new Date(b.fechaRecomendada).getTime())
    .slice(0, 3));
  readonly controlesPreventivos = computed(() => [...(this.historia()?.controlesPreventivos ?? [])]
    .sort((a, b) => new Date(b.fechaRecomendada).getTime() - new Date(a.fechaRecomendada).getTime()));
  readonly vacunas = computed(() => [...(this.historia()?.aplicacionesPreventivas ?? [])]
    .filter(aplicacion => aplicacion.tipo === 'VACUNACION')
    .sort((a, b) => new Date(b.fechaAplicacion).getTime() - new Date(a.fechaAplicacion).getTime()));
  readonly vacunasPendientes = computed(() => [...(this.historia()?.controlesPreventivos ?? [])]
    .filter(control => control.tipo === 'VACUNACION' && !['APLICADO', 'CANCELADO'].includes(control.estado))
    .sort((a, b) => new Date(a.fechaRecomendada).getTime() - new Date(b.fechaRecomendada).getTime()));
  readonly recetas = computed(() => (this.historia()?.consultas ?? [])
    .flatMap(consulta => (consulta.prescripciones ?? []).map(receta => ({ receta, consulta })))
    .sort((a, b) => new Date(b.receta.fechaInicio).getTime() - new Date(a.receta.fechaInicio).getTime()));
  readonly documentos = computed(() => (this.historia()?.consultas ?? [])
    .flatMap(consulta => (consulta.archivos ?? []).map(archivo => ({ archivo, consulta })))
    .sort((a, b) => new Date(b.archivo.fechaCarga).getTime() - new Date(a.archivo.fechaCarga).getTime()));

  readonly canModify = computed(() => this.authStore.hasAccess('VISTA_MASCOTAS', 'modificar'));
  readonly canViewHistory = computed(() => this.authStore.hasAccess('VISTA_HISTORIAS', 'leer'));

  private basePath = '/mascotas';
  private returnPage: number | null = null;

  ngOnInit(): void {
    this.basePath = this.resolveBasePath();
    const requestedTab = this.route.snapshot.queryParamMap.get('tab');
    if (requestedTab === 'historial' || requestedTab === 'documentos') {
      this.seccionActiva.set(requestedTab);
    }
    const page = Number(this.route.snapshot.queryParamMap.get('returnPage'));
    this.returnPage = Number.isInteger(page) && page > 0 ? page : null;
    const uuid = this.route.snapshot.paramMap.get('uuid');

    if (!uuid) {
      this.errorCarga.set(true);
      this.cargando.set(false);
      return;
    }

    this.mascotaService.obtenerPorUuid(uuid).pipe(
      switchMap(res => {
        const pet = res.data;
        this.mascota.set(pet);
        return this.historiaService.getPorMascota(pet.id).pipe(catchError(() => of({ data: null })));
      })
    ).subscribe({
      next: history => {
        this.historia.set(history.data as HistoriaClinicaDetalle | null);
        this.cargando.set(false);
      },
      error: () => {
        this.errorCarga.set(true);
        this.cargando.set(false);
      }
    });
  }

  volver(): void {
    this.router.navigate([this.basePath], { queryParams: { page: this.returnPage } });
  }

  editar(): void {
    const pet = this.mascota();
    if (!pet || !this.canModify()) return;
    this.router.navigate([this.basePath, 'form', pet.uuid], {
      queryParams: { returnPage: this.returnPage },
      state: pet
    });
  }

  verHistoria(): void {
    const numeroHc = this.historia()?.numeroHc;
    if (!numeroHc || !this.canViewHistory()) return;
    this.router.navigate([this.historyBasePath(), 'mascota', numeroHc], {
      queryParams: { returnUrl: `${this.basePath}/detalle/${this.mascota()?.uuid}` }
    });
  }

  abrirConsulta(id: number): void {
    if (!this.canViewHistory()) return;
    this.router.navigate([this.historyBasePath(), 'consulta', id]);
  }

  seleccionarSeccion(seccion: 'historial' | 'preventivos' | 'vacunas' | 'recetas' | 'documentos' | 'datos'): void {
    this.seccionActiva.set(seccion);
    if (seccion === 'datos') {
      queueMicrotask(() => document.getElementById('datos')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }

  archivoIcon(tipo?: string): string {
    const valor = tipo?.toUpperCase() ?? '';
    if (valor === 'LABORATORIO') return 'pi pi-chart-bar';
    if (valor === 'RADIOGRAFIA' || valor === 'ECOGRAFIA' || valor === 'IMAGEN') return 'pi pi-image';
    return 'pi pi-file';
  }

  calcularEdad(fechaNacimiento?: string): string {
    if (!fechaNacimiento) return 'No registrada';
    const hoy = new Date();
    const nac = new Date(fechaNacimiento);
    let anios = hoy.getFullYear() - nac.getFullYear();
    let meses = hoy.getMonth() - nac.getMonth();
    if (meses < 0 || (meses === 0 && hoy.getDate() < nac.getDate())) {
      anios--;
      meses += 12;
    }
    if (anios > 0) return `${anios} año${anios === 1 ? '' : 's'}`;
    if (meses > 0) return `${meses} mes${meses === 1 ? '' : 'es'}`;
    return 'Menos de 1 mes';
  }

  especieLabel(value?: string): string {
    const labels: Record<string, string> = {
      PERRO: 'Perro', GATO: 'Gato', AVE: 'Ave', ROEDOR: 'Roedor',
      CONEJO: 'Conejo', REPTIL: 'Reptil', OTRO: 'Otro'
    };
    return labels[value?.toUpperCase() ?? ''] ?? value ?? 'No registrada';
  }

  sexoLabel(value?: string): string {
    if (!value) return 'No registrado';
    return value.toUpperCase() === 'MACHO' ? 'Macho' : value.toUpperCase() === 'HEMBRA' ? 'Hembra' : value;
  }

  textoLegible(value?: string): string {
    if (!value) return 'Consulta clínica';
    return value.replaceAll('_', ' ').toLowerCase().replace(/^./, letra => letra.toUpperCase());
  }

  consultaIcon(tipo?: string, motivo?: string): string {
    const texto = `${tipo ?? ''} ${motivo ?? ''}`.toUpperCase();
    if (texto.includes('VACUN')) return 'pi pi-shield';
    if (texto.includes('DESPARASIT')) return 'pi pi-heart';
    if (texto.includes('CIRUG') || texto.includes('ESTERIL')) return 'pi pi-plus-circle';
    if (texto.includes('EMERGEN')) return 'pi pi-bolt';
    return 'pi pi-file-edit';
  }

  consultaIconClass(tipo?: string, motivo?: string): string {
    const texto = `${tipo ?? ''} ${motivo ?? ''}`.toUpperCase();
    if (texto.includes('VACUN')) return 'bg-emerald-50 text-emerald-600';
    if (texto.includes('DESPARASIT')) return 'bg-cyan-50 text-cyan-600';
    if (texto.includes('CIRUG') || texto.includes('ESTERIL')) return 'bg-violet-50 text-violet-600';
    if (texto.includes('EMERGEN')) return 'bg-rose-50 text-rose-600';
    return 'bg-blue-50 text-blue-600';
  }

  inicial(value?: string): string {
    return value?.trim().charAt(0).toUpperCase() || 'M';
  }

  private resolveBasePath(): string {
    const url = this.router.url.split('?')[0];
    if (url.startsWith('/admin/mascotas')) return '/admin/mascotas';
    if (url.startsWith('/empleado/mascotas')) return '/empleado/mascotas';
    return '/mascotas';
  }

  private historyBasePath(): string {
    if (this.basePath.startsWith('/admin/')) return '/admin/historias-clinicas';
    if (this.basePath.startsWith('/empleado/')) return '/empleado/historias-clinicas';
    return '/historias-clinicas';
  }
}
