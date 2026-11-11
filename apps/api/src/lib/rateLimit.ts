// Created by Haihs on 11/11/2026
// In-RAM fixed-window rate limiter and withRateLimit wrapper (replaces express-rate-limit of the source app).
import { HTTP_STATUS } from '@doc-to-exam/contract'; // Haihs: ánh xạ HttpError -> status khi settle - start - end
import { fail } from './apiResponse';
import { rateLimitMax } from './env';
import { HttpError, type Handler } from './handler'; // Haihs: cần HttpError (runtime) để settle theo status - start - end
// import type { Handler } from './handler'; // Haihs: đóng code cũ, đổi sang import có HttpError - start - end

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
  lastSweep: number;
}

// shortcut: per-process memory, so a multi-instance deploy multiplies the limits; per-limiter key cap evicts the oldest key when full (loses that key's count). Move to Redis if scaled out
const MAX_KEYS = 10_000;
const SWEEP_MS = 60_000;
// Next may instantiate this module once per route bundle: keep registry and timer on globalThis so there is one sweeper.
const g = globalThis as {
  __rateLimiters?: { registry: Set<RateLimiter>; timer?: ReturnType<typeof setInterval> };
};
const shared = (g.__rateLimiters ??= { registry: new Set() });
const registry = shared.registry;

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
    lastSweep: 0,
  };
  registry.add(l);
  shared.timer ??= setInterval(() => registry.forEach((x) => sweep(x)), SWEEP_MS);
  shared.timer.unref();
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
      if (now - l.lastSweep >= 1000) {
        l.lastSweep = now;
        sweep(l, now); // throttled: an attacker flooding new keys must not make every request O(keys)
      }
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
    // Every limiter reserves its slot BEFORE the handler runs (like express-rate-limit), so parallel requests cannot
    // all pass the check before any is counted; the slot is handed back in settle() when the response does not count.
    const held: { l: RateLimiter; key: string; e: { n: number; resetAt: number } }[] = [];
    const release = () => held.forEach(({ e }) => e.n > 0 && e.n--);
    for (const l of limiters) {
      const key = await l.key(req, ctx);
      if (key === null) continue;
      const now = Date.now();
      const e = entry(l, key, now);
      e.n++;
      held.push({ l, key, e });
      if (e.n > l.max) {
        // this limiter blocked: the request never reaches the handler, so none of the earlier slots were spent
        e.n--;
        held.pop();
        release();
        return limited(e.resetAt - now);
      }
    }
    const settle = (status: number) => {
      for (const { l, key, e } of held) {
        if (l.hits.get(key) !== e) continue; // window rolled over meanwhile: never touch the new window
        const counts =
          l.count === 'failures' ? status >= 400 && status < 500 : !(l.refund5xx && status >= 500);
        if (!counts && e.n > 0) e.n--;
      }
    };
    let res: Response;
    try {
      res = await h(req, ctx);
    } catch (err) {
      // Haihs: HttpError ném ra được tính theo status HTTP thật (401 vào bucket failures, 503 được hoàn) - start
      // đóng code cũ
      // settle(500);
      settle(err instanceof HttpError ? HTTP_STATUS[err.code] : 500);
      // Haihs: HttpError ném ra được tính theo status HTTP thật (401 vào bucket failures, 503 được hoàn) - end
      throw err;
    }
    settle(res.status);
    return res;
  };
}
