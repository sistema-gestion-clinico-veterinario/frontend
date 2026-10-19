import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { BackupMonitorService } from '../../../core/services/backup-monitor.service';
import { BackupExecution, BackupSummary } from '../../../models/backup/backup-execution.model';
import { BackupMonitorComponent } from './backup-monitor.component';

describe('BackupMonitorComponent', () => {
  let fixture: ComponentFixture<BackupMonitorComponent>;
  let component: BackupMonitorComponent;
  let service: jasmine.SpyObj<BackupMonitorService>;

  const execution: BackupExecution = {
    id: 1,
    runId: '123',
    runAttempt: 1,
    recoveryPointId: '01fa5bc2-2188-42cd-9d7f-631dae309327',
    retentionPolicy: 'p01',
    triggerType: 'SCHEDULED',
    status: 'SUCCESS',
    databaseStatus: 'SUCCESS',
    restrictionsStatus: 'SUCCESS',
    storageStatus: 'SUCCESS',
    restorationVerified: true,
    startedAt: '2026-10-18T07:17:00Z',
    finishedAt: '2026-10-18T07:20:28Z',
    commitSha: 'c423a72000000000000000000000000000000000',
    workflowUrl: 'https://github.com/softvet/backend/actions/runs/123'
  };

  const resumen = (parcial: Partial<BackupSummary> = {}): BackupSummary => ({
    health: 'AL_DIA',
    reportingConfigured: true,
    lastExecutionAt: '2026-10-18T07:17:00Z',
    lastSuccessAt: '2026-10-18T07:20:28Z',
    lastFailureAt: null,
    successCount30Days: 28,
    problemCount30Days: 1,
    nextScheduledAt: '2026-10-19T07:17:00Z',
    maxHoursWithoutSuccess: 36,
    ...parcial
  });

  const pagina = (contenido: BackupExecution[]) => of({
    success: true,
    message: 'ok',
    data: {
      content: contenido, totalElements: contenido.length, totalPages: 1, size: 20, number: 0,
      numberOfElements: contenido.length, first: true, last: true, empty: contenido.length === 0
    }
  });
  const respuesta = <T>(data: T) => of({ success: true, message: 'ok', data });
  const texto = () => ((fixture.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');

  async function crear(ejecuciones: BackupExecution[] = [execution], datosDelResumen: BackupSummary = resumen()): Promise<void> {
    service = jasmine.createSpyObj<BackupMonitorService>('BackupMonitorService', ['list', 'summary']);
    service.list.and.returnValue(pagina(ejecuciones));
    service.summary.and.returnValue(respuesta(datosDelResumen));
    await TestBed.configureTestingModule({
      imports: [BackupMonitorComponent],
      providers: [{ provide: BackupMonitorService, useValue: service }]
    }).compileComponents();
    fixture = TestBed.createComponent(BackupMonitorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('muestra únicamente metadatos operativos del respaldo', async () => {
    await crear();

    expect(texto()).toContain('Monitoreo de respaldos');
    expect(texto()).toContain('Prueba de recuperación');
    expect(texto()).toContain('Verificada');
    expect(texto()).toContain('01fa5bc2');
    expect(texto()).toContain('Completo');
  });

  it('traduce estados y calcula la duración', async () => {
    await crear();

    expect(component.componentLabel('SKIPPED')).toBe('No incluido');
    expect(component.policyLabel('p03')).toBe('Mensual · 365 días');
    expect(component.duration(execution)).toBe('3 min 28 s');
  });

  describe('estado general', () => {
    it('resume cómo van los respaldos con el último correcto, la próxima ejecución y el total de los últimos 30 días', async () => {
      await crear();

      expect(texto()).not.toContain('Respaldos al día');
      expect(texto()).toContain('Ejecuciones (30 días)');
      expect(texto()).toContain('29');
      expect(texto()).toContain('Siguiente ejecución');
    });

    it('avisa cuando la situación es crítica', async () => {
      await crear([execution], resumen({ health: 'CRITICO', lastSuccessAt: '2026-10-10T07:20:00Z' }));

      const problemas = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="problemas-30-dias"]') as HTMLElement;
      expect(problemas.textContent).toContain('1');
      expect(problemas.querySelector('.text-red-600')).not.toBeNull();
    });

    it('mantiene disponible el estado de la integración para diagnóstico', async () => {
      await crear([execution], resumen({ reportingConfigured: false }));
      expect(component.pasosDeConfiguracion()[0].estado).toBe('FALTA');
    });

    it('si el resumen no se puede consultar, igual muestra el historial', async () => {
      service = jasmine.createSpyObj<BackupMonitorService>('BackupMonitorService', ['list', 'summary']);
      service.list.and.returnValue(pagina([execution]));
      service.summary.and.returnValue(throwError(() => ({ status: 500 })));
      await TestBed.configureTestingModule({
        imports: [BackupMonitorComponent],
        providers: [{ provide: BackupMonitorService, useValue: service }]
      }).compileComponents();
      fixture = TestBed.createComponent(BackupMonitorComponent);
      fixture.detectChanges();

      expect(texto()).toContain('Ejecuciones reportadas');
      expect(texto()).not.toContain('Respaldos al día');
    });

    it('describe en palabras la antigüedad del último respaldo', async () => {
      await crear();
      const ahora = new Date('2026-10-18T15:00:00Z').getTime();

      expect(component.ago('2026-10-18T14:30:00Z', ahora)).toBe('hace 30 min');
      expect(component.ago('2026-10-18T10:00:00Z', ahora)).toBe('hace 5 h');
      expect(component.ago('2026-10-14T15:00:00Z', ahora)).toBe('hace 4 días');
      expect(component.ago(null)).toBe('sin registro');
    });
  });

  describe('sin reportes todavía', () => {
    it('explica qué debe cumplirse y marca lo que falta en el servidor', async () => {
      await crear([], resumen({ health: 'SIN_DATOS', reportingConfigured: false, lastExecutionAt: null, lastSuccessAt: null }));

      expect(texto()).toContain('Aún no existen reportes operativos');
      const pasos = component.pasosDeConfiguracion();
      expect(pasos.length).toBe(3);
      expect(pasos[0].estado).toBe('FALTA');
      expect(pasos[0].detalle).toContain('BACKUP_REPORT_TOKEN');
      expect(texto()).toContain('BACKUP_REPORT_URL');
      expect(texto()).toContain('Todavía no ha llegado ningún reporte');
    });

    it('si el servidor ya está configurado, ese paso figura como correcto', async () => {
      await crear([], resumen({ health: 'SIN_DATOS', reportingConfigured: true }));

      expect(component.pasosDeConfiguracion()[0].estado).toBe('LISTO');
    });
  });

  describe('presentación estándar', () => {
    it('usa los mismos colores de estado que el resto del sistema', async () => {
      await crear();

      expect(component.chipClass('SUCCESS')).toBe('bg-green-50 text-green-700');
      expect(component.chipClass('FAILED')).toBe('bg-red-50 text-red-500');
      expect(component.chipClass('PARTIAL')).toBe('bg-red-50 text-red-500');
      expect(component.chipClass('SKIPPED')).toBe('bg-slate-100 text-slate-600');
      expect(component.chipClass('IN_PROGRESS')).toBe('bg-blue-50 text-blue-600');
      expect(component.dotClass('SUCCESS')).toBe('bg-green-500');
    });

    it('lista los tres componentes de cada ejecución', async () => {
      await crear();

      expect(component.componentesDe(execution).map(c => c.nombre))
        .toEqual(['Base de datos', 'Cierre de acceso temporal', 'Archivos clínicos']);
    });

    it('solo muestra la paginación cuando hay más ejecuciones que una página', async () => {
      await crear();
      expect((fixture.nativeElement as HTMLElement).querySelector('p-paginator')).toBeNull();

      component.total.set(45);
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('p-paginator')).not.toBeNull();
    });
  });

  describe('detalle de una ejecución', () => {
    it('empieza oculto y se abre y se cierra con el botón', async () => {
      await crear();
      const root = fixture.nativeElement as HTMLElement;
      expect(root.querySelector('[data-testid="detalle-de-ejecucion"]')).toBeNull();

      (root.querySelector('tbody button') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(root.querySelector('[data-testid="detalle-de-ejecucion"]')).not.toBeNull();
      expect(texto()).toContain('N.º 123 · intento 1');
      expect(texto()).toContain('c423a72');
      expect(texto()).toContain('01fa5bc2-2188-42cd-9d7f-631dae309327');

      (root.querySelector('tbody button') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(root.querySelector('[data-testid="detalle-de-ejecucion"]')).toBeNull();
    });

    it('al abrir otra ejecución se cierra la anterior', async () => {
      await crear([execution, { ...execution, id: 2, runId: '124' }]);

      component.toggle(1);
      component.toggle(2);

      expect(component.expanded()).toBe(2);
    });
  });
});
