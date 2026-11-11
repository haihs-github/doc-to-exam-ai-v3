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
  it('over max -> 429 RATE_LIMITED, Vietnamese message, Retry-After seconds (ceil)', async () => {
    const h = withRateLimit([mk()], statusHandler(200));
    expect((await h(req())).status).toBe(200);
    expect((await h(req())).status).toBe(200);
    vi.advanceTimersByTime(250);
    const res = await h(req());
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('1');
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
      Object.entries(LIMITERS).map(([k, l]) => [k, [l.max, l.windowMs]]),
    );
    const M = 60_000;
    expect(t).toEqual({
      LOGIN: [10, 15 * M],
      REGISTER: [5, 60 * M],
      STUDENT_REGISTER: [300, 60 * M],
      REGISTER_PHONE: [5, 60 * M],
      STUDENT_LOGIN: [600, 15 * M],
      LOGIN_IP_FAIL: [150, 15 * M],
      LOGIN_ACCOUNT: [10, 15 * M],
      LOGIN_PHONE_GLOBAL: [100, 15 * M],
      CHANGE_PASSWORD: [10, 15 * M],
      STUDENT_API: [3000, M],
    });
  });
  it('REGISTER_PHONE keys by phone+IP from the body without consuming it; others by IP', async () => {
    const mkReq = (phone: string, ip: string) =>
      req({
        method: 'POST',
        body: JSON.stringify({ phoneNumber: phone }),
        headers: { 'x-forwarded-for': ip, 'content-type': 'application/json' },
      });
    vi.stubEnv('TRUST_PROXY', '1');
    const r = mkReq(' 090-1 ', '1.1.1.1');
    const k1 = await LIMITERS.REGISTER_PHONE.key(r);
    expect(k1).toBe('p:0901|1.1.1.1');
    expect(await r.json()).toEqual({ phoneNumber: ' 090-1 ' });
    expect(await LIMITERS.LOGIN_PHONE_GLOBAL.key(mkReq('0901', '2.2.2.2'))).toBe('p:0901');
    expect(await LIMITERS.LOGIN.key(mkReq('0901', '2.2.2.2'))).toBe('2.2.2.2');
    expect(
      await LIMITERS.REGISTER_PHONE.key(
        req({ method: 'POST', body: 'garbage', headers: { 'x-forwarded-for': '3.3.3.3' } }),
      ),
    ).toBe('3.3.3.3');
    expect(await LIMITERS.CHANGE_PASSWORD.key(req(), { userId: 'u1' })).toBe('u:u1');
  });
});
