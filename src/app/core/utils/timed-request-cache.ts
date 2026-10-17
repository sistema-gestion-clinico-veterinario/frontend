import { Observable, defer, shareReplay } from 'rxjs';

interface CacheEntry<T> {
  expiresAt: number;
  request$: Observable<T>;
}

/**
 * Reuses completed and in-flight read requests for a short period.
 * Consumers must invalidate the cache after a successful mutation.
 */
export class TimedRequestCache {
  private readonly entries = new Map<string, CacheEntry<unknown>>();

  constructor(private readonly ttlMs: number) {}

  get<T>(key: string, requestFactory: () => Observable<T>): Observable<T> {
    const now = Date.now();
    this.removeExpired(now);

    const cached = this.entries.get(key) as CacheEntry<T> | undefined;
    if (cached) return cached.request$;

    const request$ = defer(requestFactory).pipe(
      shareReplay({ bufferSize: 1, refCount: false })
    );

    this.entries.set(key, { expiresAt: now + this.ttlMs, request$ });
    return request$;
  }

  clear(): void {
    this.entries.clear();
  }

  private removeExpired(now: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
  }
}
