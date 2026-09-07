import { Injectable, signal } from '@angular/core';
import { ThesisMeasurementPhase } from '../../models/response/thesis-performance-measurement-response';

export interface ThesisPerformanceSessionState {
  id: string;
  phase: ThesisMeasurementPhase;
  active: boolean;
  startedAt: string;
}

@Injectable({ providedIn: 'root' })
export class ThesisPerformanceSessionService {
  private readonly storageKey = 'vargasvet.instrumento1.performance-session';
  readonly state = signal<ThesisPerformanceSessionState | null>(this.load());

  startNew(): ThesisPerformanceSessionState {
    const next: ThesisPerformanceSessionState = {
      id: crypto.randomUUID(),
      phase: 'WARMUP',
      active: true,
      startedAt: new Date().toISOString()
    };
    this.save(next);
    return next;
  }

  setPhase(phase: ThesisMeasurementPhase): void {
    const current = this.state();
    if (!current) return;
    this.save({ ...current, phase, active: true });
  }

  pause(): void {
    const current = this.state();
    if (!current) return;
    this.save({ ...current, active: false });
  }

  resume(): void {
    const current = this.state();
    if (!current) return;
    this.save({ ...current, active: true });
  }

  requestHeaders(): Record<string, string> | null {
    const current = this.state();
    if (!current?.active) return null;
    return {
      'X-Thesis-Measurement-Session': current.id,
      'X-Thesis-Measurement-Phase': current.phase
    };
  }

  private save(value: ThesisPerformanceSessionState): void {
    this.state.set(value);
    localStorage.setItem(this.storageKey, JSON.stringify(value));
  }

  private load(): ThesisPerformanceSessionState | null {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as ThesisPerformanceSessionState;
      if (!parsed.id || !['WARMUP', 'SAMPLE'].includes(parsed.phase) || typeof parsed.active !== 'boolean') {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }
}
