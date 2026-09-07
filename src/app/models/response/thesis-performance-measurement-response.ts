export type ThesisMeasurementPhase = 'WARMUP' | 'SAMPLE';

export interface ThesisPerformanceMeasurement {
  id: number;
  measurementSessionId: string;
  phase: ThesisMeasurementPhase;
  requestedAt: string;
  operationCode: string;
  operationName: string;
  routeTemplate: string;
  httpMethod: string;
  durationMs: number;
  httpStatus: number;
  successful: boolean;
  companyId: number | null;
}
