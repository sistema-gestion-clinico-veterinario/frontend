import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '../../store/auth.store';
import { RouteMapperService } from './route-mapper.service';

export interface GuidedTourStep {
  id: string;
  title: string;
  description: string;
  selector: string;
  route?: string;
  beforeClickSelector?: string;
  cleanupClickSelector?: string;
  preferredPosition?: 'top' | 'right' | 'bottom' | 'left';
}

export interface TourTargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const GUIDE_KEY = 'inicio-softvet';
const GUIDE_VERSION = 1;

@Injectable({ providedIn: 'root' })
export class GuidedTourService {
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly routeMapper = inject(RouteMapperService);

  readonly active = signal(false);
  readonly offerVisible = signal(false);
  readonly currentIndex = signal(0);
  readonly steps = signal<GuidedTourStep[]>([]);
  readonly targetRect = signal<TourTargetRect | null>(null);
  readonly currentStep = computed(() => this.steps()[this.currentIndex()] ?? null);
  readonly totalSteps = computed(() => this.steps().length);

  private contextKey = '';
  private operation = 0;

  initialize(): void {
    const roleId = this.authStore.activeRoleId();
    if (roleId == null) return;
    const storageKey = this.storageKey(roleId);
    if (storageKey === this.contextKey) return;
    this.contextKey = storageKey;
    this.offerVisible.set(this.readStatus(storageKey) == null);
  }

  start(): void {
    const steps = this.buildSteps();
    if (!steps.length) return;
    this.steps.set(steps);
    this.currentIndex.set(0);
    this.offerVisible.set(false);
    this.active.set(true);
    this.persist('EN_PROGRESO');
    void this.showCurrent();
  }

  postpone(): void {
    this.offerVisible.set(false);
    this.persist('POSPUESTA');
  }

  close(): void {
    this.cleanupCurrentStep();
    this.operation++;
    this.active.set(false);
    this.targetRect.set(null);
    this.persist('POSPUESTA');
  }

  async next(): Promise<void> {
    this.cleanupCurrentStep();
    if (this.currentIndex() >= this.steps().length - 1) {
      this.finish();
      return;
    }
    this.currentIndex.update(value => value + 1);
    this.persist('EN_PROGRESO');
    await this.showCurrent();
  }

  async previous(): Promise<void> {
    if (this.currentIndex() === 0) return;
    this.cleanupCurrentStep();
    this.currentIndex.update(value => value - 1);
    this.persist('EN_PROGRESO');
    await this.showCurrent();
  }

  refreshTarget(): void {
    if (!this.active()) return;
    const selector = this.currentStep()?.selector;
    if (!selector) return;
    const element = this.findVisibleElement(selector);
    if (element) this.setRect(element);
  }

  private finish(): void {
    this.cleanupCurrentStep();
    this.operation++;
    this.active.set(false);
    this.targetRect.set(null);
    this.offerVisible.set(false);
    this.persist('COMPLETADA');
  }

  private async showCurrent(): Promise<void> {
    const operation = ++this.operation;
    const step = this.currentStep();
    if (!step || !this.active()) return;
    this.targetRect.set(null);

    if (step.route && this.router.url.split('?')[0] !== step.route) {
      window.dispatchEvent(new CustomEvent('softvet-tour-close-mobile-sidebar'));
      await this.router.navigateByUrl(step.route);
      await this.delay(180);
    }
    if (operation !== this.operation || !this.active()) return;

    if (step.beforeClickSelector) {
      const activator = await this.waitForElement(step.beforeClickSelector, 3500);
      if (activator) {
        activator.click();
        await this.delay(180);
      }
    }

    if (step.id.startsWith('menu-')) {
      window.dispatchEvent(new CustomEvent('softvet-tour-reveal-menu', {
        detail: { code: step.id.substring(5) }
      }));
      await this.delay(120);
    }

    const element = await this.waitForElement(step.selector, 4500);
    if (operation !== this.operation || !this.active()) return;
    if (!element) {
      await this.skipMissingStep();
      return;
    }
    element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    await this.delay(240);
    if (operation === this.operation) this.setRect(element);
  }

  private async skipMissingStep(): Promise<void> {
    if (this.currentIndex() >= this.steps().length - 1) {
      this.finish();
      return;
    }
    this.currentIndex.update(value => value + 1);
    await this.showCurrent();
  }

  private cleanupCurrentStep(): void {
    const selector = this.currentStep()?.cleanupClickSelector;
    if (!selector) return;
    this.findVisibleElement(selector)?.click();
  }

  private setRect(element: HTMLElement): void {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    this.targetRect.set({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
  }

  private async waitForElement(selector: string, timeoutMs: number): Promise<HTMLElement | null> {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const element = this.findVisibleElement(selector);
      if (element) return element;
      await this.delay(80);
    }
    return null;
  }

  private findVisibleElement(selector: string): HTMLElement | null {
    return [...document.querySelectorAll<HTMLElement>(selector)]
      .find(element => element.getClientRects().length > 0) ?? null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => window.setTimeout(resolve, ms));
  }

  private persist(status: 'EN_PROGRESO' | 'POSPUESTA' | 'COMPLETADA'): void {
    if (!this.contextKey) return;
    try {
      window.localStorage.setItem(this.contextKey, status);
    } catch {
      // La guía sigue siendo utilizable aunque el navegador bloquee el almacenamiento local.
    }
  }

  private readStatus(storageKey: string): string | null {
    try {
      return window.localStorage.getItem(storageKey);
    } catch {
      return null;
    }
  }

  private storageKey(roleId: number): string {
    const userId = this.jwtClaim('userId') ?? this.hashIdentity(this.jwtClaim('sub') ?? 'usuario');
    const companyId = this.authStore.companyId() ?? 'platform';
    return `softvet:onboarding:${GUIDE_KEY}:v${GUIDE_VERSION}:u${userId}:c${companyId}:r${roleId}`;
  }

  private jwtClaim(name: string): string | number | null {
    const token = this.authStore.token();
    if (!token) return null;
    try {
      const encoded = token.split('.')[1];
      if (!encoded) return null;
      const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
      const payload = JSON.parse(window.atob(padded)) as Record<string, unknown>;
      const value = payload[name];
      return typeof value === 'string' || typeof value === 'number' ? value : null;
    } catch {
      return null;
    }
  }

  private hashIdentity(value: string | number): string {
    let hash = 2166136261;
    for (const character of String(value)) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  private buildSteps(): GuidedTourStep[] {
    const purpose = this.authStore.activeRolePurpose();
    const steps: GuidedTourStep[] = [
      {
        id: 'guide-entry', title: 'Guía de inicio',
        description: 'Puedes volver a abrir este recorrido en cualquier momento desde aquí.',
        selector: '[data-tour="guide-launcher"]', preferredPosition: 'right'
      }
    ];

    if (this.authStore.availableRoles().length > 1) {
      steps.push({
        id: 'active-role-selector',
        title: 'Cambiar de rol',
        description: 'Tienes más de un rol asignado. Usa esta opción para cambiar tu rol activo; el menú y los permisos se actualizarán según tu selección.',
        selector: '[data-tour="active-role-selector"]',
        preferredPosition: 'bottom'
      });
    }

    if (purpose === 'PLATFORM_ADMIN') {
      const companiesRoute = this.routeMapper.getRoute('VISTA_COMPANY') ?? '/admin/company';
      steps.push(
        this.menuStep('VISTA_COMPANY', 'Clínicas y empresas', 'Desde esta opción administras las clínicas contratantes y su configuración.'),
        {
          id: 'company-create', title: 'Registrar una clínica',
          description: 'Este botón abre el formulario de alta. El recorrido no guardará ningún dato.',
          selector: '[data-tour="company-create"]', route: companiesRoute, preferredPosition: 'bottom'
        },
        {
          id: 'company-modal', title: 'Formulario de registro',
          description: 'Aquí se completan los datos institucionales, acceso y horarios. Puedes cerrarlo sin registrar nada.',
          selector: '[data-tour="company-modal"]', route: companiesRoute,
          beforeClickSelector: '[data-tour="company-create"]',
          cleanupClickSelector: '[data-tour="company-modal-close"]', preferredPosition: 'left'
        },
        this.menuStep('VISTA_AUDITORIA_ADMIN', 'Auditoría', 'Consulta eventos relevantes y acciones administrativas registradas por la plataforma.')
      );
    } else if (purpose === 'CLIENT_PORTAL') {
      steps.push(
        this.menuStep('VISTA_MIS_MASCOTAS', 'Mis mascotas', 'Consulta la información y el historial disponible de tus mascotas.'),
        this.menuStep('VISTA_MIS_CITAS', 'Mis citas', 'Programa y revisa las atenciones veterinarias.'),
        this.menuStep('VISTA_PROFILE', 'Privacidad y perfil', 'Desde tu perfil puedes revisar tus datos y las decisiones de privacidad habilitadas.')
      );
    } else {
      const agendaCode = this.firstAvailableCode([
        'VISTA_CITAS_AGENDA_ADMIN',
        'VISTA_CITAS_AGENDA_EMPLEADO',
        'VISTA_CITAS_AGENDA'
      ]);
      const historiesCode = this.firstAvailableCode([
        'VISTA_HISTORIAS_ADMIN',
        'VISTA_HISTORIAS_EMPLEADO',
        'VISTA_HISTORIAS'
      ]);
      const agendaRoute = agendaCode
        ? (this.routeMapper.getRoute(agendaCode) ?? '/citas/agenda')
        : '/citas/agenda';
      const canCreateAppointments = agendaCode != null && this.menuHasPermission(agendaCode, 'escribir');
      steps.push(
        ...(agendaCode
          ? [
              this.menuStep(agendaCode, 'Agenda de citas', 'Aquí se programan y administran las atenciones de la clínica.'),
              ...(canCreateAppointments ? [{
                id: 'appointment-create', title: 'Crear una cita',
                description: 'Este botón abre el formulario. Solo se registra una cita cuando confirmas el guardado.',
                selector: '[data-tour="appointment-create"]', route: agendaRoute, preferredPosition: 'bottom'
              },
              {
                id: 'appointment-modal', title: 'Formulario de cita',
                description: 'Selecciona cliente, mascota, servicio, profesional y horario. La guía cerrará el formulario sin guardar.',
                selector: '[data-tour="appointment-modal"]', route: agendaRoute,
                beforeClickSelector: '[data-tour="appointment-create"]',
                cleanupClickSelector: '[data-tour="appointment-modal-close"]', preferredPosition: 'left'
              }] as GuidedTourStep[] : [])
            ] as GuidedTourStep[]
          : []),
        ...(historiesCode
          ? [this.menuStep(historiesCode, 'Historias clínicas', 'Accede al historial médico y a las herramientas clínicas permitidas para tu rol.')]
          : [])
      );
    }
    return steps.filter(step => !step.id.startsWith('menu-') || this.menuContains(step.id.substring(5)));
  }

  private menuStep(code: string, title: string, description: string): GuidedTourStep {
    return {
      id: `menu-${code}`, title, description,
      selector: `[data-tour-menu="${code}"]`, preferredPosition: 'right'
    };
  }

  private menuContains(code: string): boolean {
    return (this.authStore.menu() ?? []).some(item => {
      if ('vistas' in item) return item.vistas.some(view => view.codigo === code && view.leer !== false);
      return item.codigo === code && item.leer !== false;
    });
  }

  private menuHasPermission(code: string, permission: 'leer' | 'escribir' | 'modificar' | 'eliminar'): boolean {
    return (this.authStore.menu() ?? []).some(item => {
      if ('vistas' in item) return item.vistas.some(view => view.codigo === code && view[permission] === true);
      return item.codigo === code && item[permission] === true;
    });
  }

  private firstAvailableCode(codes: string[]): string | null {
    return codes.find(code => this.menuContains(code)) ?? null;
  }
}
