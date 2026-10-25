import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { EMPTY, Subject, catchError, filter, switchMap } from 'rxjs';
import { FINALIDAD_USO_IA } from '../constants/privacidad.constants';
import { PRIVACY_RESOLUTION_ROUTES, APP_ROUTE_PATHS, toAbsoluteRoute } from '../routing/app-routes.constants';
import { ConsentimientoEstado } from '../../models/privacy/privacidad.model';
import { PendientePrivacidad } from '../../models/ui/pendiente-privacidad.model';
import { AuthStore } from '../../store/auth.store';
import { PrivacidadService } from './privacidad.service';
import { BackupMonitorService } from './backup-monitor.service';
import { BackupExecution } from '../../models/backup/backup-execution.model';

const CLAVE_DESCARTADOS = 'pendientes_privacidad_descartados';

@Injectable({ providedIn: 'root' })
export class PendientesPrivacidadService {
  private readonly privacidad = inject(PrivacidadService);
  private readonly respaldos = inject(BackupMonitorService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly estado = signal<ConsentimientoEstado | null>(null);
  private readonly ejecucionesRespaldos = signal<readonly BackupExecution[]>([]);
  private readonly descartados = signal<readonly string[]>([]);
  private readonly consultas = new Subject<void>();
  private readonly consultasRespaldos = new Subject<void>();
  private urlAnterior = '';

  readonly pendientes = computed<PendientePrivacidad[]>(() => {
    const estado = this.estado();
    const lista: PendientePrivacidad[] = [];

    if (this.authStore.activeRolePurpose() === 'PLATFORM_ADMIN') {
      for (const ejecucion of this.ejecucionesRespaldos()) {
        lista.push({
          id: `respaldo-${ejecucion.id}`,
          titulo: ejecucion.status === 'PARTIAL' ? 'Respaldo parcial' : 'Respaldo fallido',
          detalle: this.detalleRespaldo(ejecucion),
          ruta: toAbsoluteRoute(APP_ROUTE_PATHS.BACKUP_MONITOR),
          opcional: false
        });
      }
    }

    if (estado?.avisoPublicado && !estado.vistaPorLaPersona) {
      const actualizado = estado.informadaVersion != null && estado.avisoVersion != null
        && estado.informadaVersion < estado.avisoVersion;
      lista.push({
        id: 'aviso',
        titulo: actualizado ? 'Aviso de privacidad actualizado' : 'Aviso de privacidad',
        detalle: actualizado
          ? 'La clínica actualizó su aviso de privacidad. Revísalo y confirma tu lectura.'
          : 'Revisa el aviso de privacidad de la clínica y confirma tu lectura.',
        ruta: toAbsoluteRoute(APP_ROUTE_PATHS.PROFILE),
        fragmento: 'privacidad',
        opcional: false
      });
    }

    if (this.authStore.needsLegalAcceptance()) {
      lista.push({
        id: 'terminos',
        titulo: 'Documentos de SoftVet actualizados',
        detalle: this.authStore.legalAcceptanceOverdue()
          ? 'El plazo para revisar los términos y la política de privacidad venció. Revisa las acciones pendientes.'
          : 'SoftVet actualizó sus términos de uso o su política de privacidad. Revísalos desde esta notificación.',
        ruta: toAbsoluteRoute(APP_ROUTE_PATHS.LEGAL_ACCEPTANCE),
        opcional: false
      });
    }

    const decisionIa = estado?.finalidades.find(f => f.codigo === FINALIDAD_USO_IA)?.estado;
    if (this.authStore.activeRolePurpose() === 'CLIENT_PORTAL' && decisionIa === 'SIN_REGISTRO'
        && !this.descartados().includes('ia')) {
      lista.push({
        id: 'ia',
        titulo: 'Uso de inteligencia artificial',
        detalle: 'Es opcional. Indica si autorizas su uso con los datos clínicos de tus mascotas.',
        ruta: toAbsoluteRoute(APP_ROUTE_PATHS.PROFILE),
        fragmento: 'privacidad',
        opcional: true
      });
    }

    return lista;
  });

  constructor() {
    this.consultas.pipe(
      switchMap(() => this.privacidad.miEstado().pipe(catchError(() => EMPTY))),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(({ data }) => this.estado.set(data));

    this.consultasRespaldos.pipe(
      switchMap(() => this.respaldos.list(0, 50).pipe(catchError(() => EMPTY))),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(({ data }) => {
      const desde = Date.now() - 30 * 24 * 60 * 60 * 1000;
      this.ejecucionesRespaldos.set((data?.content ?? []).filter(ejecucion =>
        (ejecucion.status === 'FAILED' || ejecucion.status === 'PARTIAL')
        && new Date(ejecucion.startedAt).getTime() >= desde));
    });

    effect((onCleanup) => {
      const clave = this.clave();
      const esAdministradorPlataforma = this.authStore.activeRolePurpose() === 'PLATFORM_ADMIN';
      untracked(() => {
        this.estado.set(null);
        this.ejecucionesRespaldos.set([]);
        this.descartados.set(this.leerDescartados(clave));
        this.refrescar();
      });
      if (esAdministradorPlataforma) {
        const intervalo = window.setInterval(() => this.refrescar(), 5 * 60 * 1000);
        onCleanup(() => window.clearInterval(intervalo));
      }
    });

    this.router.events.pipe(
      filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(evento => {
      const desde = this.urlAnterior;
      this.urlAnterior = evento.urlAfterRedirects;
      if (this.pendientes().length > 0 && PRIVACY_RESOLUTION_ROUTES.some(ruta => desde.includes(ruta))) this.refrescar();
    });

  }

  refrescar(): void {
    if (this.authStore.activeRolePurpose() === 'PLATFORM_ADMIN') {
      this.estado.set(null);
      this.consultasRespaldos.next();
      return;
    }
    this.ejecucionesRespaldos.set([]);
    if (!this.authStore.companyId()) {
      this.estado.set(null);
      return;
    }
    this.consultas.next();
  }

  private detalleRespaldo(ejecucion: BackupExecution): string {
    const fecha = new Intl.DateTimeFormat('es-PE', {
      dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Lima'
    }).format(new Date(ejecucion.startedAt));
    const componentes = [
      ['Base de datos', ejecucion.databaseStatus],
      ['Cierre de acceso temporal', ejecucion.restrictionsStatus],
      ['Archivos clínicos', ejecucion.storageStatus]
    ] as const;
    const fallidos = componentes.filter(([, estado]) => estado === 'FAILED').map(([nombre]) => nombre);
    const partes = [fecha];
    if (fallidos.length) partes.push(`Falló: ${fallidos.join(', ')}`);
    return partes.join(' · ');
  }

  descartar(id: PendientePrivacidad['id']): void {
    const pendiente = this.pendientes().find(p => p.id === id);
    if (!pendiente?.opcional) return;
    const lista = [...this.descartados(), id];
    this.descartados.set(lista);
    try {
      sessionStorage.setItem(`${CLAVE_DESCARTADOS}:${this.clave()}`, JSON.stringify(lista));
    } catch {}
  }

  private clave(): string {
    return `${this.authStore.companyId()}:${this.authStore.activeRoleId()}`;
  }

  private leerDescartados(clave: string): string[] {
    try {
      const guardado = JSON.parse(sessionStorage.getItem(`${CLAVE_DESCARTADOS}:${clave}`) ?? '[]');
      return Array.isArray(guardado) ? guardado.filter(item => typeof item === 'string') : [];
    } catch {
      return [];
    }
  }
}
