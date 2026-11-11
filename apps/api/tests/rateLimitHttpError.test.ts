// Created by Haihs on 11/11/2026
// withRateLimit must settle a thrown HttpError by its HTTP status; withErrors adds Retry-After for SERVER_BUSY.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError, withErrors } from '../src/lib/handler';
import { createRateLimiter, resetRateLimiters, withRateLimit } from '../src/lib/rateLimit';

let n = 0;
const mk = (o: Partial<Parameters<typeof createRateLimiter>[0]> = {}) =>
  createRateLimiter({ name: `H${n++}`, max: 2, windowMs: 60_000, key: () => 'k', ...o });
const req = () => new Request('http://x/');
beforeEach(() => vi.stubEnv('NODE_ENV', 'development'));
afterEach(() => {
  vi.unstubAllEnvs();
  resetRateLimiters();
});

describe('withRateLimit with thrown HttpError', () => {
  it("'failures' bucket counts a thrown 401: 3rd request -> 429 without entering the handler", async () => {
    const spy = vi.fn(async () => {
      throw new HttpError('INVALID_CREDENTIALS', 'x');
    });
    const h = withErrors(withRateLimit([mk({ count: 'failures' })], spy));
    expect((await h(req())).status).toBe(401);
    expect((await h(req())).status).toBe(401);
    expect((await h(req())).status).toBe(429);
    expect(spy).toHaveBeenCalledTimes(2);
  });
  it('refund5xx bucket: thrown 409 still counts, thrown SERVER_BUSY (503) is refunded', async () => {
    let code: 'PHONE_TAKEN' | 'SERVER_BUSY' = 'PHONE_TAKEN';
    const spy = vi.fn(async () => {
      throw new HttpError(code, 'x');
    });
    const h = withErrors(withRateLimit([mk({ refund5xx: true })], spy));
    await h(req());
    await h(req());
    expect((await h(req())).status).toBe(429); // 409s counted
    resetRateLimiters();
    code = 'SERVER_BUSY';
    for (let i = 0; i < 5; i++) expect((await h(req())).status).toBe(503); // refunded each time
    expect(spy).toHaveBeenCalledTimes(5 + 3 - 1);
  });
  it('a non-HttpError throw is still settled as 500', async () => {
    const h = withRateLimit([mk({ refund5xx: true })], async () => {
      throw new Error('boom');
    });
    for (let i = 0; i < 5; i++) await expect(h(req())).rejects.toThrow('boom');
  });
});

describe('withErrors Retry-After', () => {
  it('SERVER_BUSY gets Retry-After: 5, other errors none', async () => {
    const busy = await withErrors(async () => {
      throw new HttpError('SERVER_BUSY', 'bận');
    })(req());
    expect(busy.status).toBe(503);
    expect(busy.headers.get('Retry-After')).toBe('5');
    const other = await withErrors(async () => {
      throw new HttpError('VALIDATION', 'x');
    })(req());
    expect(other.headers.get('Retry-After')).toBeNull();
  });
});
