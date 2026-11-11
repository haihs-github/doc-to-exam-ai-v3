// Created by Haihs on 11/11/2026
// Tests for backoff + jitter + Retry-After and retryWithBackoff (port of client/tests/retry.test.js; axios-style errors become ApiFailure {status, retryAfter}).
import {
  parseRetryAfterMs, computeBackoffDelayMs, isRetryableError, getRetryAfterFromError, retryWithBackoff, RETRYABLE_STATUSES,
} from './retry';

const httpError = (status: number, retryAfter?: string) => ({ status, retryAfter });

describe('retry', () => {
  it('RETRYABLE_STATUSES (retry.js:7)', () => {
    expect(RETRYABLE_STATUSES).toEqual([408, 429, 503]);
  });

  it('parseRetryAfterMs đọc số giây, ngày HTTP, chặn trần 60s và bỏ giá trị lạ', () => {
    expect(parseRetryAfterMs('3')).toBe(3000);
    expect(parseRetryAfterMs('0')).toBe(0);
    expect(parseRetryAfterMs('9999')).toBe(60000);
    expect(parseRetryAfterMs(undefined)).toBeNull();
    expect(parseRetryAfterMs('abc')).toBeNull();
    const now = Date.parse('2026-10-28T10:00:00Z');
    expect(parseRetryAfterMs('Wed, 28 Oct 2026 10:00:05 GMT', now)).toBe(5000);
    expect(parseRetryAfterMs('Wed, 28 Oct 2026 09:00:00 GMT', now)).toBe(0);
  });

  it('computeBackoffDelayMs tăng theo cấp số nhân, có trần, jitter 50-100%', () => {
    const lo = () => 0;
    const hi = () => 0.999999;
    expect(computeBackoffDelayMs({ attempt: 1, baseMs: 1000, maxMs: 20000, random: lo })).toBe(500);
    expect(computeBackoffDelayMs({ attempt: 1, baseMs: 1000, maxMs: 20000, random: hi })).toBe(1000);
    expect(computeBackoffDelayMs({ attempt: 3, baseMs: 1000, maxMs: 20000, random: hi })).toBe(4000);
    expect(computeBackoffDelayMs({ attempt: 10, baseMs: 1000, maxMs: 20000, random: hi })).toBe(20000);
    expect(computeBackoffDelayMs({ attempt: 10, baseMs: 1000, maxMs: 20000, random: lo })).toBe(10000);
  });

  it('computeBackoffDelayMs luôn chờ ít nhất Retry-After và cộng jitter', () => {
    const delayLow = computeBackoffDelayMs({ attempt: 1, baseMs: 1000, retryAfterMs: 3000, random: () => 0 });
    expect(delayLow).toBe(3000);
    const delayHigh = computeBackoffDelayMs({ attempt: 1, baseMs: 1000, retryAfterMs: 3000, random: () => 0.999999 });
    expect(delayHigh).toBeGreaterThanOrEqual(3000);
    expect(delayHigh).toBeLessThanOrEqual(4500);
  });

  it('hai client cùng gặp 503 không quay lại cùng một thời điểm (jitter)', () => {
    const delays = new Set<number>();
    for (let i = 0; i < 20; i += 1) delays.add(computeBackoffDelayMs({ attempt: 2, baseMs: 1500, retryAfterMs: 3000, random: Math.random }));
    expect(delays.size).toBeGreaterThan(10);
  });

  it('isRetryableError: 503/429/408 và mất mạng (status 0) được thử lại; 400/401/403/413/500 và hủy thì không', () => {
    [503, 429, 408].forEach((s) => expect(isRetryableError(httpError(s))).toBe(true));
    [400, 401, 403, 413, 500].forEach((s) => expect(isRetryableError(httpError(s))).toBe(false));
    expect(isRetryableError(httpError(0))).toBe(true);
    expect(isRetryableError({ message: 'Network Error' })).toBe(true);
    expect(isRetryableError({ code: 'ERR_CANCELED' })).toBe(false);
    expect(isRetryableError({ name: 'AbortError' })).toBe(false);
  });

  it('getRetryAfterFromError đọc retryAfter của ApiFailure', () => {
    expect(getRetryAfterFromError(httpError(503, '3'))).toBe(3000);
    expect(getRetryAfterFromError(httpError(503))).toBeNull();
    expect(getRetryAfterFromError(null)).toBeNull();
  });

  it('retryWithBackoff thử lại tới khi thành công, ngủ đúng khoảng và báo onRetry', async () => {
    const sleeps: number[] = [];
    const retries: number[] = [];
    let calls = 0;
    const result = await retryWithBackoff(async () => {
      calls += 1;
      if (calls < 3) throw httpError(503, '2');
      return 'ok';
    }, {
      baseMs: 1000, random: () => 0, sleep: async (ms) => { sleeps.push(ms); }, onRetry: (info) => retries.push(info.attempt),
    });
    expect(result).toBe('ok');
    expect(calls).toBe(3);
    expect(sleeps).toEqual([2000, 2000]);
    expect(retries).toEqual([1, 2]);
  });

  it('retryWithBackoff dừng ngay với lỗi không đáng thử lại và sau maxAttempts', async () => {
    let calls = 0;
    await expect(retryWithBackoff(async () => { calls += 1; throw httpError(413); }, { sleep: async () => undefined })).rejects.toBeTruthy();
    expect(calls).toBe(1);

    calls = 0;
    await expect(retryWithBackoff(async () => { calls += 1; throw httpError(503); }, { maxAttempts: 4, sleep: async () => undefined })).rejects.toBeTruthy();
    expect(calls).toBe(4);
  });

  it('defaultSleep hủy được bằng AbortSignal (fake timers)', async () => {
    vi.useFakeTimers();
    try {
      const ac = new AbortController();
      const p = retryWithBackoff(async () => { throw httpError(503); }, { random: () => 0, signal: ac.signal });
      const assertion = expect(p).rejects.toMatchObject({ code: 'ERR_CANCELED' });
      await vi.advanceTimersByTimeAsync(0);
      ac.abort();
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
