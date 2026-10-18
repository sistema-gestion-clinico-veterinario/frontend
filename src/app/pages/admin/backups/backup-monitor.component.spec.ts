import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { BackupMonitorService } from '../../../core/services/backup-monitor.service';
import { BackupExecution } from '../../../models/backup/backup-execution.model';
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

  beforeEach(async () => {
    service = jasmine.createSpyObj<BackupMonitorService>('BackupMonitorService', ['list']);
    service.list.and.returnValue(of({
      success: true,
      message: 'ok',
      data: {
        content: [execution], totalElements: 1, totalPages: 1, size: 20, number: 0,
        numberOfElements: 1, first: true, last: true, empty: false
      }
    }));
    await TestBed.configureTestingModule({
      imports: [BackupMonitorComponent],
      providers: [{ provide: BackupMonitorService, useValue: service }]
    }).compileComponents();
    fixture = TestBed.createComponent(BackupMonitorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('muestra únicamente metadatos operativos del respaldo', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Respaldo y recuperación');
    expect(text).toContain('Restauración verificada');
    expect(text).toContain('01fa5bc2');
    expect(text).toContain('Completo');
  });

  it('traduce estados y calcula la duración', () => {
    expect(component.componentLabel('SKIPPED')).toBe('No incluido');
    expect(component.policyLabel('p03')).toBe('Mensual · 365 días');
    expect(component.duration(execution)).toBe('3 min 28 s');
  });
});
