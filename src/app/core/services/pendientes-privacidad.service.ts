import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { EMPTY, Subject, catchError, filter, switchMap } from 'rxjs';
import { AuthStore } from '../../store/auth.store';
import { ConsentimientoEstado, PrivacidadService, USO_IA } from './privacidad.service';

export interface PendientePrivacidad {
  id: 'aviso' | 'terminos' | 'ia';
  titulo: string;
  detalle: string;
  ruta: string;
  fragmento?: string;
  opcional: boolean;
}

const CLAVE_DESCARTADOS = 'pendientes_privacidad_descartados';
const ESPERA_AL_VOLVER_MS = 60_000;
const PANTALLAS_QUE_RESUELVEN = ['/aviso-clinica', '/legal/accept', '/profile'];

/**
 * Reúne lo que la persona aún debe revisar o decidir sobre su privacidad: el aviso de la clínica, los términos de la
 * plataforma y, si es cliente, la autorización opcional de IA. Cuando todo está al día no hay pendientes; si se publica
 * una versión nueva vuelven a aparecer.
 */
@Injectable({ providedIn: 'root' })
export class PendientesPrivacidadService {
  private readonly privacidad = inject(PrivacidadService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly estado = signal<ConsentimientoEstado | null>(null);
  private readonly descartados = signal<readonly string[]>([]);
  private readonly consultas = new Subject<void>();
  private ultimaVisita = 0;
  private urlAnterior = '';

  readonly pendientes = computed<PendientePrivacidad[]>(() => {
    const estado = this.estado();
    const lista: PendientePrivacidad[] = [];

    if (estado?.avisoPublicado && !estado.vistaPorLaPersona) {
      const actualizado = estado.informadaVersion != null && estado.avisoVersion != null
        && estado.informadaVersion < estado.avisoVersion;
      lista.push({
        id: 'aviso',
        titulo: actualizado ? 'Aviso de privacidad actualizado' : 'Aviso de privacidad',
        detalle: actualizado
          ? 'La clínica actualizó su aviso de privacidad. Revísalo y confirma tu lectura.'
          : 'Revisa el aviso de privacidad de la clínica y confirma tu lectura.',
        ruta: '/profile',
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
        ruta: '/legal/accept',
        opcional: false
      });
    }

    const decisionIa = estado?.finalidades.find(f => f.codigo === USO_IA)?.estado;
    if (this.authStore.activeRolePurpose() === 'CLIENT_PORTAL' && decisionIa === 'SIN_REGISTRO'
        && !this.descartados().includes('ia')) {
      lista.push({
        id: 'ia',
        titulo: 'Uso de inteligencia artificial',
        detalle: 'Es opcional. Indica si autorizas su uso con los datos clínicos de tus mascotas.',
        ruta: '/profile',
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

    effect(() => {
      const clave = this.clave();
      untracked(() => {
        this.estado.set(null);
        this.descartados.set(this.leerDescartados(clave));
        this.refrescar();
      });
    });

    this.router.events.pipe(
      filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(evento => {
      const desde = this.urlAnterior;
      this.urlAnterior = evento.urlAfterRedirects;
      if (this.pendientes().length > 0 && PANTALLAS_QUE_RESUELVEN.some(ruta => desde.includes(ruta))) this.refrescar();
    });

    if (typeof document !== 'undefined') {
      const alVolver = () => {
        if (document.visibilityState !== 'visible') return;
        const ahora = Date.now();
        if (ahora - this.ultimaVisita < ESPERA_AL_VOLVER_MS) return;
        this.ultimaVisita = ahora;
        this.refrescar();
      };
      document.addEventListener('visibilitychange', alVolver);
      this.destroyRef.onDestroy(() => document.removeEventListener('visibilitychange', alVolver));
    }
  }

  refrescar(): void {
    if (!this.authStore.companyId()) {
      this.estado.set(null);
      return;
    }
    this.consultas.next();
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
