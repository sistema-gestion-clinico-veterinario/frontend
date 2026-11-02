export type BackupRunStatus = 'IN_PROGRESS' | 'SUCCESS' | 'PARTIAL' | 'FAILED';
export type BackupComponentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
export type BackupTriggerType = 'SCHEDULED' | 'MANUAL';

export interface BackupExecution {
  id: number;
  runId: string;
  runAttempt: number;
  recoveryPointId: string | null;
  retentionPolicy: 'p01' | 'p02' | 'p03' | null;
  triggerType: BackupTriggerType;
  status: BackupRunStatus;
  databaseStatus: BackupComponentStatus;
  restrictionsStatus: BackupComponentStatus;
  storageStatus: BackupComponentStatus;
  protectedSizeBytes: number;
  protectedFileCount: number;
  compressionAlgorithm: string | null;
  encryptionAlgorithm: string | null;
  databaseRestoreVerified: boolean;
  databaseRestoreDurationSeconds: number | null;
  startedAt: string;
  finishedAt: string | null;
  commitSha: string | null;
  workflowUrl: string;
}

export type BackupHealth = 'SIN_DATOS' | 'AL_DIA' | 'ATENCION' | 'CRITICO';

export interface BackupSummary {
  health: BackupHealth;
  reportingConfigured: boolean;
  lastExecutionAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  successCount30Days: number;
  problemCount30Days: number;
  nextScheduledAt: string;
  maxHoursWithoutSuccess: number;
  rpoTargetHours: number;
  rpoObservedMinutes: number | null;
  rpoCompliant: boolean | null;
  rtoTargetMinutes: number;
  latestDatabaseRestoreDurationSeconds: number | null;
  integralRecoveryTestAvailable: boolean;
}
