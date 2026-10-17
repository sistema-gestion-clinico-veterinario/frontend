import { of } from 'rxjs';
import { TimedRequestCache } from './timed-request-cache';

describe('TimedRequestCache', () => {
  it('reuses the same request while its entry remains valid', () => {
    const cache = new TimedRequestCache(60_000);
    let calls = 0;
    const request = () => {
      calls += 1;
      return of({ value: calls });
    };

    cache.get('clinic:1', request).subscribe();
    cache.get('clinic:1', request).subscribe();

    expect(calls).toBe(1);
  });

  it('keeps entries isolated by key', () => {
    const cache = new TimedRequestCache(60_000);
    let calls = 0;
    const request = () => {
      calls += 1;
      return of(calls);
    };

    cache.get('clinic:1', request).subscribe();
    cache.get('clinic:2', request).subscribe();

    expect(calls).toBe(2);
  });

  it('requests fresh data after clearing the cache', () => {
    const cache = new TimedRequestCache(60_000);
    let calls = 0;
    const request = () => {
      calls += 1;
      return of(calls);
    };

    cache.get('clinic:1', request).subscribe();
    cache.clear();
    cache.get('clinic:1', request).subscribe();

    expect(calls).toBe(2);
  });
});
