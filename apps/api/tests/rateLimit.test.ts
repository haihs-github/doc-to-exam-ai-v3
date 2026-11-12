// Created by Haihs on 11/11/2026
// Tests for the in-RAM rate limiter, withRateLimit wrapper, env overrides and limiter buckets.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRateLimiter, resetRateLimiters, withRateLimit } from '../src/lib/rateLimit';
import { LIMITERS } from '../src/lib/limiters';
import { loadEnv, rateLimitMax } from '../src/lib/env';
import { ok, fail } from '../src/lib/apiResponse';

const req = (init?: RequestInit) => new Request('http://x/', init);
const statusHandler = (s: number) => async () =>
  s === 200 ? ok({}) : s === 400 ? fail('VALIDATION', 'x') : new Response(null, { status: s });
let n = 0;
const mk = (o: Partial<Parameters<typeof createRateLimiter>[0]> = {}) =>
  createRateLimiter({ name: `T${n++}`, max: 2, windowMs: 1000, key: () => 'k', ...o });

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'development');
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  resetRateLimiters();
});

describe('withRateLimit', () => {
  it('over max -> 429 RATE_LIMITED, Vietnamese message, Retry-After seconds (ceil), handler not called', async () => {
    const spy = vi.fn(statusHandler(200));
    const h = withRateLimit([mk({ windowMs: 2500 })], spy);
    expect((await h(req())).status).toBe(200);
    expect((await h(req())).status).toBe(200);
    vi.advanceTimersByTime(400); // 2100ms left: ceil -> 3, floor would be 2
    const res = await h(req());
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('3');
    expect(spy).toHaveBeenCalledTimes(2);
    const body = await res.json();
    expect(body).toMatchObject({ success: false, code: 'RATE_LIMITED' });
    expect(body.message).toContain('quá nhiều lần');
  });
  it('window expires -> allowed again', async () => {
    const h = withRateLimit([mk({ max: 1 })], statusHandler(200));
    await h(req());
    expect((await h(req())).status).toBe(429);
    vi.advanceTimersByTime(1001);
    expect((await h(req())).status).toBe(200);
  });
  it("count:'failures' ignores 200 and 5xx, counts 4xx", async () => {
    const l = mk({ max: 1, count: 'failures' });
    for (let i = 0; i < 5; i++)
      expect((await withRateLimit([l], statusHandler(200))(req())).status).toBe(200);
    for (let i = 0; i < 5; i++)
      expect((await withRateLimit([l], statusHandler(503))(req())).status).toBe(503);
    expect((await withRateLimit([l], statusHandler(400))(req())).status).toBe(400);
    expect((await withRateLimit([l], statusHandler(200))(req())).status).toBe(429);
  });
  it('failures: 20 parallel requests reserve slots up front (max=3) -> exactly 3 reach the handler', async () => {
    const spy = vi.fn(async () => {
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 10));
      return new Response(null, { status: 401 });
    });
    const h = withRateLimit([mk({ max: 3, count: 'failures' })], spy);
    const pending = Promise.all(Array.from({ length: 20 }, () => h(req())));
    await vi.advanceTimersByTimeAsync(20);
    const statuses = (await pending).map((r) => r.status);
    expect(spy).toHaveBeenCalledTimes(3);
    expect(statuses.filter((s) => s === 429)).toHaveLength(17);
  });
  it('failures: success, 5xx and a throwing handler give the slot back', async () => {
    const l = mk({ max: 1, count: 'failures' });
    await withRateLimit([l], statusHandler(200))(req());
    await withRateLimit([l], statusHandler(503))(req());
    await expect(
      withRateLimit([l], async () => {
        throw new Error('x');
      })(req()),
    ).rejects.toThrow();
    expect((await withRateLimit([l], statusHandler(401))(req())).status).toBe(401);
    expect((await withRateLimit([l], statusHandler(200))(req())).status).toBe(429);
  });
  it.each([
    [399, false],
    [400, true],
    [499, true],
    [500, false],
  ])('failures: status %i consumes the slot = %s', async (status, consumed) => {
    const l = mk({ max: 1, count: 'failures' });
    expect((await withRateLimit([l], statusHandler(status))(req())).status).toBe(status);
    expect((await withRateLimit([l], statusHandler(200))(req())).status).toBe(consumed ? 429 : 200);
  });
  it('a refund after the window rolled over does not touch the new window', async () => {
    const l = mk({ max: 1, count: 'failures', windowMs: 1000 });
    const slow = withRateLimit([l], async () => {
      await new Promise((r) => setTimeout(r, 1500));
      return new Response(null, { status: 200 });
    });
    const first = slow(req());
    await vi.advanceTimersByTimeAsync(1100);
    await withRateLimit([l], statusHandler(401))(req()); // new window, consumes its slot
    await vi.advanceTimersByTimeAsync(500);
    await first; // refund of the OLD window entry must not give the new window's slot back
    expect((await withRateLimit([l], statusHandler(200))(req())).status).toBe(429);
    expect(l.hits.get('k')?.n).toBe(1); // the new window's own counter was not decremented
  });
  it('refund5xx gives the hit back, 4xx still counts', async () => {
    const l = mk({ max: 1, refund5xx: true });
    for (let i = 0; i < 3; i++)
      expect((await withRateLimit([l], statusHandler(503))(req())).status).toBe(503);
    expect((await withRateLimit([l], statusHandler(400))(req())).status).toBe(400);
    expect((await withRateLimit([l], statusHandler(200))(req())).status).toBe(429);
  });
  it('a throwing handler is refunded when refund5xx', async () => {
    const l = mk({ max: 1, refund5xx: true });
    const boom = withRateLimit([l], async () => {
      throw new Error('x');
    });
    await expect(boom(req())).rejects.toThrow();
    expect((await withRateLimit([l], statusHandler(200))(req())).status).toBe(200);
  });
  it('null key skips the limiter; async key and ctx are supported', async () => {
    const skip = mk({ max: 1, key: () => null });
    const h = withRateLimit([skip], statusHandler(200));
    for (let i = 0; i < 3; i++) expect((await h(req())).status).toBe(200);
    const byUser = mk({ max: 1, key: async (_r, ctx) => ctx?.userId ?? null });
    const h2 = withRateLimit([byUser], statusHandler(200));
    expect((await h2(req(), { userId: 'a' })).status).toBe(200);
    expect((await h2(req(), { userId: 'b' })).status).toBe(200);
    expect((await h2(req(), { userId: 'a' })).status).toBe(429);
  });
  it('NODE_ENV=test bypasses every limiter (read at call time)', async () => {
    const h = withRateLimit([mk({ max: 1 })], statusHandler(200));
    vi.stubEnv('NODE_ENV', 'test');
    for (let i = 0; i < 3; i++) expect((await h(req())).status).toBe(200);
  });
  it('RATE_LIMIT_<NAME>_MAX overrides max; invalid values are ignored', async () => {
    const l = mk({ name: 'OVR', max: 1 });
    vi.stubEnv('RATE_LIMIT_OVR_MAX', '3');
    const h = withRateLimit([l], statusHandler(200));
    for (let i = 0; i < 3; i++) expect((await h(req())).status).toBe(200);
    expect((await h(req())).status).toBe(429);
    expect(rateLimitMax('X', 7, { RATE_LIMIT_X_MAX: 'abc' })).toBe(7);
    expect(rateLimitMax('X', 7, { RATE_LIMIT_X_MAX: '0' })).toBe(7);
    expect(rateLimitMax('X', 7, { RATE_LIMIT_X_MAX: '-2' })).toBe(7);
    expect(rateLimitMax('X', 7, { RATE_LIMIT_X_MAX: '1.5' })).toBe(7);
    expect(rateLimitMax('X', 7, { RATE_LIMIT_X_MAX: '9' })).toBe(9);
  });
  it('tracked keys are capped and expired windows are swept by the timer', async () => {
    // fresh module so its sweep interval is created under fake timers
    const g = globalThis as { __rateLimiters?: { timer?: ReturnType<typeof setInterval> } };
    clearInterval(g.__rateLimiters?.timer);
    delete g.__rateLimiters;
    vi.resetModules();
    const m = await import('../src/lib/rateLimit');
    const l = m.createRateLimiter({
      name: 'CAP',
      max: 1000,
      windowMs: 1000,
      key: (r) => r.headers.get('k'),
    });
    const h = m.withRateLimit([l], statusHandler(200));
    for (let i = 0; i < 10_500; i++) await h(req({ headers: { k: String(i) } }));
    expect(m.trackedKeyCount(l)).toBeLessThanOrEqual(10_000);
    vi.advanceTimersByTime(120_000);
    expect(m.trackedKeyCount(l)).toBe(0);
  });
});

describe('env', () => {
  it('trustProxy defaults: 1 in production, 0 otherwise; TRUST_PROXY overrides', () => {
    const prod = {
      NODE_ENV: 'production',
      JWT_SECRET: 'x'.repeat(16),
      API_KEY_ENCRYPTION_SECRET: 'x'.repeat(16),
      TEACHER_SECRET_KEY: 'x'.repeat(8),
      MONGODB_URI: 'mongodb://h/d',
    };
    expect(loadEnv(prod).trustProxy).toBe(1);
    expect(loadEnv({ ...prod, TRUST_PROXY: '2' }).trustProxy).toBe(2);
    expect(loadEnv({}).trustProxy).toBe(0);
    expect(loadEnv({ TRUST_PROXY: 'abc' }).trustProxy).toBe(0);
  });
});

describe('limiters buckets', () => {
  it('match backend inventory 1.4', () => {
    const t = Object.fromEntries(
      Object.entries(LIMITERS).map(([k, l]) => [k, [l.max, l.windowMs, l.count, l.refund5xx]]),
    );
    const M = 60_000;
    expect(t).toEqual({
      LOGIN: [10, 15 * M, 'all', false],
      REGISTER: [5, 60 * M, 'all', false],
      STUDENT_REGISTER: [300, 60 * M, 'all', true],
      REGISTER_PHONE: [5, 60 * M, 'all', true],
      STUDENT_LOGIN: [600, 15 * M, 'all', true],
      LOGIN_IP_FAIL: [150, 15 * M, 'failures', false],
      LOGIN_ACCOUNT: [10, 15 * M, 'failures', false],
      LOGIN_PHONE_GLOBAL: [100, 15 * M, 'failures', false],
      CHANGE_PASSWORD: [10, 15 * M, 'failures', false],
      STUDENT_API: [3000, M, 'all', false],
      // Haihs: M2-M6 thêm bucket lớp/ca thi/upload (khớp backend inventory 1.4) - start
      CLASS_JOIN_IP: [600, 10 * M, 'all', false],
      CLASS_JOIN: [20, 10 * M, 'all', false],
      MEMBER_SEARCH: [60, 10 * M, 'all', false],
      MEMBER_SEARCH_DAY: [500, 24 * 60 * M, 'all', false],
      MEMBER_LOOKUP: [200, 10 * M, 'all', false],
      CSV_IMPORT: [10, 10 * M, 'all', false],
      RESET_PASSWORD: [100, 10 * M, 'all', true],
      DUPLICATE: [10, M, 'all', false],
      TEACHER_UPLOAD: [10, 10 * M, 'all', false],
      SITTING_RESOLVE: [20, 10 * M, 'failures', false],
      SITTING_RESOLVE_IP: [300, 10 * M, 'failures', false],
      SITTING_START: [400, M, 'all', true],
      SITTING_START_USER: [30, M, 'all', true],
      SITTING_SUBMIT: [400, M, 'all', true],
      SITTING_SUBMIT_USER: [10, M, 'all', true],
      RESULT_VIEW: [400, M, 'all', true],
      RESULT_VIEW_USER: [30, M, 'all', true],
      ESSAY_UPLOAD_IP: [1200, M, 'all', true],
      ESSAY_UPLOAD_BAD: [30, M, 'failures', false],
      ESSAY_UPLOAD_SESSION: [12, M, 'all', true],
      // Haihs: M2-M6 thêm bucket - end
    });
  });
  it('REGISTER_PHONE keys by valid phone+IP from the body without consuming it; others by ip: key', async () => {
    const mkReq = (phone: string, ip: string) =>
      req({
        method: 'POST',
        body: JSON.stringify({ phoneNumber: phone }),
        headers: { 'x-forwarded-for': ip, 'content-type': 'application/json' },
      });
    vi.stubEnv('TRUST_PROXY', '1');
    const r = mkReq(' 090-123.4567 ', '1.1.1.1');
    expect(await LIMITERS.REGISTER_PHONE.key(r)).toBe('p:0901234567|1.1.1.1');
    expect(await r.json()).toEqual({ phoneNumber: ' 090-123.4567 ' });
    expect(await LIMITERS.LOGIN_PHONE_GLOBAL.key(mkReq('0901234567', '2.2.2.2'))).toBe(
      'p:0901234567',
    );
    expect(await LIMITERS.LOGIN.key(mkReq('0901234567', '2.2.2.2'))).toBe('ip:2.2.2.2');
    const garbage = req({
      method: 'POST',
      body: 'garbage',
      headers: { 'x-forwarded-for': '3.3.3.3' },
    });
    expect(await LIMITERS.REGISTER_PHONE.key(garbage)).toBe('ip:3.3.3.3');
    expect(await LIMITERS.CHANGE_PASSWORD.key(req(), { userId: 'u1' })).toBe('u:u1');
  });
  it('malformed or huge phoneNumber never becomes part of a key (IP-only fallback, key <= 64 chars)', async () => {
    vi.stubEnv('TRUST_PROXY', '1');
    const mkReq = (phone: unknown) =>
      req({
        method: 'POST',
        body: JSON.stringify({ phoneNumber: phone }),
        headers: { 'x-forwarded-for': '4.4.4.4' },
      });
    for (const bad of ['9'.repeat(900_000), '12345', 'abc0901234567', '1901234567', 42, null]) {
      for (const l of [
        LIMITERS.REGISTER_PHONE,
        LIMITERS.LOGIN_ACCOUNT,
        LIMITERS.LOGIN_PHONE_GLOBAL,
      ]) {
        const k = (await l.key(mkReq(bad))) as string;
        expect(k).toBe('ip:4.4.4.4');
      }
    }
    // a hostile XFF entry is capped too
    const long = req({ headers: { 'x-forwarded-for': 'y'.repeat(5000) } });
    expect(((await LIMITERS.LOGIN.key(long)) as string).length).toBeLessThanOrEqual(64);
  });
  it('registry survives module duplication (globalThis) and resetRateLimiters clears all copies', async () => {
    const g = globalThis as { __rateLimiters?: { timer?: ReturnType<typeof setInterval> } };
    clearInterval(g.__rateLimiters?.timer);
    delete g.__rateLimiters;
    vi.resetModules();
    const a = await import('../src/lib/rateLimit');
    const l = a.createRateLimiter({ name: 'DUP', max: 5, windowMs: 1000, key: () => 'k' });
    await a.withRateLimit([l], statusHandler(200))(req());
    expect(a.trackedKeyCount(l)).toBe(1);
    vi.resetModules();
    const other = await import('../src/lib/rateLimit');
    other.resetRateLimiters();
    expect(a.trackedKeyCount(l)).toBe(0);
  });
});
