import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { BackupMonitorService } from '../../../core/services/backup-monitor.service';
import {
  BackupComponentStatus,
  BackupExecution,
  BackupHealth,
  BackupRunStatus,
  BackupSummary
} from '../../../models/backup/backup-execution.model';

interface PasoDeConfiguracion {
  titulo: string;
  detalle: string;
  estado: 'LISTO' | 'FALTA' | 'VERIFICAR';
}

@Component({
  selector: 'app-backup-monitor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './backup-monitor.component.html'
})
export class BackupMonitorComponent implements OnInit {
  private readonly service = inject(BackupMonitorService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly executions = signal<BackupExecution[]>([]);
  readonly summary = signal<BackupSummary | null>(null);
  readonly expanded = signal<number | null>(null);
  readonly total = signal(0);
  readonly page = signal(0);
  readonly pageSize = 20;
  readonly latest = computed(() => this.executions()[0] ?? null);
  readonly hasPreviousPage = computed(() => this.page() > 0);
  readonly hasNextPage = computed(() => (this.page() + 1) * this.pageSize < this.total());

  readonly pasosDeConfiguracion = computed<PasoDeConfiguracion[]>(() => {
    const resumen = this.summary();
    return [
      {
        titulo: 'El servidor puede recibir los reportes',
        detalle: resumen === null
          ? 'No se pudo comprobar la configuración del servidor.'
          : resumen.reportingConfigured
            ? 'La variable BACKUP_REPORT_TOKEN está configurada en el servidor.'
            : 'Falta definir BACKUP_REPORT_TOKEN en el servidor, con un valor aleatorio de al menos 32 caracteres.',
        estado: resumen === null ? 'VERIFICAR' : resumen.reportingConfigured ? 'LISTO' : 'FALTA'
      },
      {
        titulo: 'GitHub Actions conoce la dirección y el token',
        detalle: 'En el repositorio deben existir la variable BACKUP_REPORT_URL (la dirección del servidor, terminada en /api/v1) y el secreto BACKUP_REPORT_TOKEN, con el mismo valor que el servidor.',
        estado: 'VERIFICAR'
      },
      {
        titulo: 'El workflow se ejecutó después de configurarlo',
        detalle: 'Los reportes solo llegan cuando el workflow corre con la integración activa. Una ejecución anterior no se puede reportar después. Puedes lanzarlo a mano desde la pestaña Actions de GitHub.',
        estado: 'VERIFICAR'
      }
    ];
  });

  ngOnInit(): void {
    this.load(0);
  }

  load(page: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.summary().subscribe({
      next: response => this.summary.set(response.data),
      error: () => this.summary.set(null)
    });
    this.service.list(page, this.pageSize).subscribe({
      next: response => {
        this.executions.set(response.data.content ?? []);
        this.total.set(response.data.totalElements ?? response.data.page?.totalElements ?? 0);
        this.page.set(page);
        this.expanded.set(null);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo consultar el estado de los respaldos.');
        this.loading.set(false);
      }
    });
  }

  toggle(id: number): void {
    this.expanded.update(actual => (actual === id ? null : id));
  }

  statusLabel(status: BackupRunStatus): string {
    return ({ IN_PROGRESS: 'En ejecución', SUCCESS: 'Completo', PARTIAL: 'Parcial', FAILED: 'Fallido' })[status];
  }

  componentLabel(status: BackupComponentStatus): string {
    return ({ PENDING: 'Pendiente', SUCCESS: 'Correcto', FAILED: 'Fallido', SKIPPED: 'No incluido' })[status];
  }

  statusClass(status: BackupRunStatus | BackupComponentStatus): string {
    if (status === 'SUCCESS') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (status === 'FAILED') return 'bg-rose-50 text-rose-700 border-rose-200';
    if (status === 'PARTIAL' || status === 'SKIPPED') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-blue-50 text-blue-700 border-blue-200';
  }

  healthLabel(health: BackupHealth): string {
    return ({
      SIN_DATOS: 'Sin información todavía',
      AL_DIA: 'Respaldos al día',
      ATENCION: 'Requiere atención',
      CRITICO: 'Situación crítica'
    })[health];
  }

  healthClass(health: BackupHealth): string {
    return ({
      SIN_DATOS: 'border-slate-200 bg-slate-50 text-slate-700',
      AL_DIA: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      ATENCION: 'border-slate-300 bg-slate-100 text-slate-800',
      CRITICO: 'border-rose-200 bg-rose-50 text-rose-800'
    })[health];
  }

  healthIcon(health: BackupHealth): string {
    return ({
      SIN_DATOS: 'pi pi-info-circle',
      AL_DIA: 'pi pi-check-circle',
      ATENCION: 'pi pi-exclamation-circle',
      CRITICO: 'pi pi-times-circle'
    })[health];
  }

  healthMessage(summary: BackupSummary): string {
    switch (summary.health) {
      case 'AL_DIA':
        return `El último respaldo correcto fue ${this.ago(summary.lastSuccessAt)}.`;
      case 'ATENCION':
        return summary.lastSuccessAt
          ? `Hace más de ${summary.maxHoursWithoutSuccess} horas o con un fallo reciente. Último respaldo correcto: ${this.ago(summary.lastSuccessAt)}.`
          : 'La última ejecución no terminó bien.';
      case 'CRITICO':
        return summary.lastSuccessAt
          ? `No hay un respaldo correcto desde ${this.ago(summary.lastSuccessAt)}. Revisa la última ejecución en GitHub.`
          : 'Ninguna de las ejecuciones reportadas terminó correctamente.';
      default:
        return 'Cuando el workflow reporte su primera ejecución aparecerá aquí el estado de los respaldos.';
    }
  }

  ago(value: string | null, now: number = Date.now()): string {
    if (!value) return 'sin registro';
    const minutes = Math.max(0, Math.round((now - new Date(value).getTime()) / 60000));
    if (minutes < 1) return 'hace un momento';
    if (minutes < 60) return `hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 48) return `hace ${hours} h`;
    return `hace ${Math.floor(hours / 24)} días`;
  }

  policyLabel(policy: BackupExecution['retentionPolicy']): string {
    if (!policy) return 'No registrada';
    return ({ p01: 'Diario · 30 días', p02: 'Semanal · 180 días', p03: 'Mensual · 365 días' } as const)[policy];
  }

  duration(execution: BackupExecution): string {
    if (!execution.finishedAt) return 'En curso';
    const seconds = Math.max(0, Math.round(
      (new Date(execution.finishedAt).getTime() - new Date(execution.startedAt).getTime()) / 1000
    ));
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return minutes > 0 ? `${minutes} min ${remainder} s` : `${remainder} s`;
  }

  shortId(value: string | null): string {
    return value ? value.slice(0, 8) : 'Pendiente';
  }

  shortCommit(value: string | null): string {
    return value ? value.slice(0, 7) : 'No registrado';
  }
}
