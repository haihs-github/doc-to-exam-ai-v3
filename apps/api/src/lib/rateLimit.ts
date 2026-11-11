// Created by Haihs on 11/11/2026
// In-RAM fixed-window rate limiter and withRateLimit wrapper (replaces express-rate-limit of the source app).
import { fail } from './apiResponse';
import { rateLimitMax } from './env';
import type { Handler } from './handler';

type Ctx = any; // eslint-disable-line @typescript-eslint/no-explicit-any -- route-specific Next ctx, same as Handler

export interface RateLimiterOptions {
  name: string;
  max: number;
  windowMs: number;
  /** null = skip this limiter for the request. May be async (reads a cloned body). */
  key: (req: Request, ctx?: Ctx) => string | null | Promise<string | null>;
  /** 'all' counts every request; 'failures' counts only responses with status 400-499. */
  count?: 'all' | 'failures';
  /** Give the hit back when the response is 5xx (or the handler throws). Only meaningful for count 'all'. */
  refund5xx?: boolean;
}
export interface RateLimiter extends Required<Omit<RateLimiterOptions, 'max'>> {
  readonly max: number; // effective value: RATE_LIMIT_<NAME>_MAX override applied at call time
  readonly hits: Map<string, { n: number; resetAt: number }>;
}

// shortcut: per-process memory, so a multi-instance deploy multiplies the limits; per-limiter key cap evicts the oldest key when full (loses that key's count). Move to Redis if scaled out
const MAX_KEYS = 10_000;
const SWEEP_MS = 60_000;
const registry = new Set<RateLimiter>();
let timer: ReturnType<typeof setInterval> | undefined;

function sweep(l: RateLimiter, now = Date.now()) {
  for (const [k, e] of l.hits) if (e.resetAt <= now) l.hits.delete(k);
}

export function createRateLimiter(o: RateLimiterOptions): RateLimiter {
  const l: RateLimiter = {
    count: 'all',
    refund5xx: false,
    ...o,
    get max() {
      return rateLimitMax(o.name, o.max);
    },
    hits: new Map(),
  };
  registry.add(l);
  timer ??= setInterval(() => registry.forEach((x) => sweep(x)), SWEEP_MS);
  timer.unref();
  return l;
}

/** Tests only: drop all counters. */
export function resetRateLimiters() {
  registry.forEach((l) => l.hits.clear());
}
export const trackedKeyCount = (l: RateLimiter) => l.hits.size;

function entry(l: RateLimiter, key: string, now: number) {
  let e = l.hits.get(key);
  if (!e || e.resetAt <= now) {
    if (!e && l.hits.size >= MAX_KEYS) {
      sweep(l, now);
      if (l.hits.size >= MAX_KEYS) l.hits.delete(l.hits.keys().next().value as string);
    }
    e = { n: 0, resetAt: now + l.windowMs };
    l.hits.set(key, e);
  }
  return e;
}

const limited = (retryMs: number) => {
  const res = fail('RATE_LIMITED', 'Bạn thao tác quá nhiều lần. Vui lòng đợi một lát rồi thử lại.');
  res.headers.set('Retry-After', String(Math.max(1, Math.ceil(retryMs / 1000))));
  return res;
};

export function withRateLimit(limiters: RateLimiter[], h: Handler): Handler {
  return async (req, ctx) => {
    if (process.env.NODE_ENV === 'test') return h(req, ctx);
    const active: { l: RateLimiter; key: string }[] = [];
    for (const l of limiters) {
      const key = await l.key(req, ctx);
      if (key === null) continue;
      const now = Date.now();
      const e = entry(l, key, now);
      // 'all' reserves its slot up front; 'failures' only blocks once max failures are already recorded
      if (l.count === 'all') e.n++;
      if (l.count === 'all' ? e.n > l.max : e.n >= l.max) return limited(e.resetAt - now);
      active.push({ l, key });
    }
    const settle = (status: number) => {
      const now = Date.now();
      for (const { l, key } of active) {
        if (l.count === 'failures') {
          if (status >= 400 && status < 500) entry(l, key, now).n++;
        } else if (l.refund5xx && status >= 500) {
          const e = l.hits.get(key);
          if (e && e.resetAt > now && e.n > 0) e.n--;
        }
      }
    };
    let res: Response;
    try {
      res = await h(req, ctx);
    } catch (err) {
      settle(500);
      throw err;
    }
    settle(res.status);
    return res;
  };
}
