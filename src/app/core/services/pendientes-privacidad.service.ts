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
import { CompanyComplianceService } from './company-compliance.service';
import { SolicitudCambioCumplimiento } from '../../models/privacy/company-compliance.model';
import { NotificationReadService } from './notification-read.service';
import { sondeoVisible } from '../utils/sondeo-visible';

const CLAVE_DESCARTADOS = 'pendientes_privacidad_descartados';

@Injectable({ providedIn: 'root' })
export class PendientesPrivacidadService {
  private readonly privacidad = inject(PrivacidadService);
  private readonly respaldos = inject(BackupMonitorService);
  private readonly cumplimiento = inject(CompanyComplianceService);
  private readonly notificationRead = inject(NotificationReadService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly estado = signal<ConsentimientoEstado | null>(null);
  private readonly ejecucionesRespaldos = signal<readonly BackupExecution[]>([]);
  private readonly solicitudesPlataforma = signal<readonly SolicitudCambioCumplimiento[]>([]);
  private readonly decisionesClinica = signal<readonly SolicitudCambioCumplimiento[]>([]);
  private readonly descartados = signal<readonly string[]>([]);
  private readonly leidosPersistentes = signal<readonly string[]>([]);
  private readonly consultas = new Subject<void>();
  private readonly consultasRespaldos = new Subject<void>();
  private readonly consultasSolicitudes = new Subject<void>();
  private readonly consultasDecisiones = new Subject<void>();
  private readonly consultasLeidas = new Subject<void>();
  private urlAnterior = '';

  readonly pendientes = computed<PendientePrivacidad[]>(() => {
    const estado = this.estado();
    const lista: PendientePrivacidad[] = [];

    if (this.authStore.isSuperAdmin()) {
      for (const ejecucion of this.ejecucionesRespaldos()) {
        const id: PendientePrivacidad['id'] = `respaldo-${ejecucion.id}`;
        if (this.descartados().includes(id) || this.leidosPersistentes().includes(id)) continue;
        lista.push({
          id,
          titulo: ejecucion.status === 'PARTIAL' ? 'Respaldo parcial' : 'Respaldo fallido',
          detalle: this.detalleRespaldo(ejecucion),
          ruta: toAbsoluteRoute(APP_ROUTE_PATHS.BACKUP_MONITOR),
          opcional: false,
          descartable: true
        });
      }
      for (const solicitud of this.solicitudesPlataforma()) {
        lista.push({
          id: `cumplimiento-${solicitud.id}`,
          titulo: solicitud.estado === 'EN_REVISION' ? 'Solicitud en revisión' : 'Nueva solicitud de cumplimiento',
          detalle: `${solicitud.empresa} · ${this.nombreControl(solicitud.control)}`,
          ruta: toAbsoluteRoute(APP_ROUTE_PATHS.COMPLIANCE_REQUESTS),
          opcional: false
        });
      }
    }

    if (this.authStore.activeRolePurpose() === 'COMPANY_ADMIN') {
      for (const solicitud of this.decisionesClinica()) {
        lista.push({
          id: `cumplimiento-${solicitud.id}`,
          titulo: solicitud.estado === 'APROBADA' ? 'Cambio aprobado' : 'Cambio rechazado',
          detalle: `${this.nombreControl(solicitud.control)} · ${solicitud.comentarioResolucion ?? 'Revisa la decisión.'}`,
          ruta: toAbsoluteRoute(APP_ROUTE_PATHS.CLINIC_COMPLIANCE),
          opcional: false,
          descartable: true
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
        && !this.descartados().includes('ia') && !this.leidosPersistentes().includes('ia')) {
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
      switchMap(() => this.respaldos.list(0, 50, true).pipe(catchError(() => EMPTY))),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(({ data }) => {
      const desde = Date.now() - 30 * 24 * 60 * 60 * 1000;
      this.ejecucionesRespaldos.set((data?.content ?? []).filter(ejecucion =>
        (ejecucion.status === 'FAILED' || ejecucion.status === 'PARTIAL')
        && new Date(ejecucion.startedAt).getTime() >= desde));
    });

    this.consultasSolicitudes.pipe(
      switchMap(() => this.cumplimiento.bandejaGlobal({ page: 0, size: 100 }, true).pipe(catchError(() => EMPTY))),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(({ data }) => this.solicitudesPlataforma.set(
      (data?.content ?? []).filter(s => s.estado === 'PENDIENTE' || s.estado === 'EN_REVISION')));

    this.consultasDecisiones.pipe(
      switchMap(() => this.cumplimiento.notificacionesDeMiClinica().pipe(catchError(() => EMPTY))),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(({ data }) => this.decisionesClinica.set(data ?? []));

    this.consultasLeidas.pipe(
      switchMap(() => this.notificationRead.listRead().pipe(catchError(() => EMPTY))),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(({ data }) => this.leidosPersistentes.set(data ?? []));

    effect((onCleanup) => {
      const clave = this.clave();
      const esAdministradorPlataforma = this.authStore.isSuperAdmin();
      untracked(() => {
        this.estado.set(null);
        this.ejecucionesRespaldos.set([]);
        this.solicitudesPlataforma.set([]);
        this.decisionesClinica.set([]);
        this.leidosPersistentes.set([]);
        this.descartados.set(this.leerDescartados(clave));
        this.refrescar();
      });
      if (esAdministradorPlataforma) {
        const sondeo = sondeoVisible(5 * 60 * 1000).subscribe(() => this.refrescar());
        onCleanup(() => sondeo.unsubscribe());
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
    if (this.authStore.activeRoleId()) this.consultasLeidas.next();
    if (this.authStore.isSuperAdmin()) {
      this.estado.set(null);
      this.consultasRespaldos.next();
      this.consultasSolicitudes.next();
      return;
    }
    this.ejecucionesRespaldos.set([]);
    this.solicitudesPlataforma.set([]);
    if (!this.authStore.companyId()) {
      this.estado.set(null);
      return;
    }
    this.consultas.next();
    if (this.authStore.activeRolePurpose() === 'COMPANY_ADMIN') this.consultasDecisiones.next();
  }

  private detalleRespaldo(ejecucion: BackupExecution): string {
    const fecha = new Intl.DateTimeFormat('es-PE', {
      dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Lima'
    }).format(new Date(ejecucion.startedAt));
    const componentes = [
      ['Base de datos', ejecucion.databaseStatus],
      ['Cierre de acceso temporal', ejecucion.restrictionsStatus],
      ['Archivos clínicos', ejecucion.storageStatus],
      ['Recuperación integral', ejecucion.recoveryStatus]
    ] as const;
    const fallidos = componentes.filter(([, estado]) => estado === 'FAILED').map(([nombre]) => nombre);
    const partes = [fecha];
    if (fallidos.length) partes.push(`Falló: ${fallidos.join(', ')}`);
    return partes.join(' · ');
  }

  descartar(id: PendientePrivacidad['id']): void {
    const pendiente = this.pendientes().find(p => p.id === id);
    if (!pendiente || (!pendiente.opcional && !pendiente.descartable)) return;
    if (id.startsWith('cumplimiento-')) {
      const solicitudId = Number(id.replace('cumplimiento-', ''));
      if (Number.isFinite(solicitudId)) {
        this.cumplimiento.marcarDecisionVista(solicitudId).subscribe({
          next: () => this.decisionesClinica.update(lista => lista.filter(s => s.id !== solicitudId))
        });
      }
      return;
    }
    const lista = [...new Set([...this.descartados(), id])];
    this.descartados.set(lista);
    this.leidosPersistentes.update(actual => [...new Set([...actual, id])]);
    this.notificationRead.markRead(id).pipe(catchError(() => EMPTY)).subscribe();
    try {
      sessionStorage.setItem(`${CLAVE_DESCARTADOS}:${this.clave()}`, JSON.stringify(lista));
    } catch {}
  }

  private nombreControl(control: SolicitudCambioCumplimiento['control']): string {
    const nombres: Record<SolicitudCambioCumplimiento['control'], string> = {
      AVISO_PRIVACIDAD: 'Aviso de privacidad', DERECHOS_DATOS: 'Derechos de datos',
      USO_IA: 'Uso de IA', RECORDATORIOS_CORREO: 'Recordatorios por correo',
      CONSENTIMIENTO_VETERINARIO: 'Consentimiento veterinario'
    };
    return nombres[control];
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
