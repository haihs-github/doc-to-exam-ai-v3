// Created by Haihs on 11/11/2026
// Rate-limit buckets of the account endpoints (values from backend inventory 1.4, source server/middlewares/rateLimit.js).
import { clientIp } from './clientIp';
import { loadEnv } from './env';
import { readJson } from './handler';
import { createRateLimiter, type RateLimiterOptions } from './rateLimit';

const M = 60_000;
const ip = (req: Request) => clientIp(req, loadEnv().trustProxy);

// Same normalisation as the source legacyPhoneKey. The body is read from a clone (cached per request), so the
// route handler can still read the original; unreadable or phone-less bodies fall back to the IP-only key.
const phones = new WeakMap<Request, Promise<string>>();
function phoneOf(req: Request): Promise<string> {
  let p = phones.get(req);
  if (!p) {
    p = readJson(req.clone())
      .then((b) =>
        typeof (b as { phoneNumber?: unknown })?.phoneNumber === 'string'
          ? (b as { phoneNumber: string }).phoneNumber.trim().replace(/[\s.-]/g, '')
          : '',
      )
      .catch(() => '');
    phones.set(req, p);
  }
  return p;
}
const phonePair: RateLimiterOptions['key'] = async (req) => {
  const phone = await phoneOf(req);
  return phone ? `p:${phone}|${ip(req)}` : ip(req);
};
const phoneOnly: RateLimiterOptions['key'] = async (req) => {
  const phone = await phoneOf(req);
  return phone ? `p:${phone}` : ip(req);
};
// Task 7 puts withRateLimit INSIDE the auth wrapper, which passes the user as ctx.userId; unauthenticated falls back to IP.
const user: RateLimiterOptions['key'] = (req, ctx) => (ctx?.userId ? `u:${ctx.userId}` : ip(req));

export const LIMITERS = {
  LOGIN: createRateLimiter({ name: 'LOGIN', max: 10, windowMs: 15 * M, key: ip }),
  REGISTER: createRateLimiter({ name: 'REGISTER', max: 5, windowMs: 60 * M, key: ip }),
  STUDENT_REGISTER: createRateLimiter({
    name: 'STUDENT_REGISTER',
    max: 300,
    windowMs: 60 * M,
    key: ip,
    refund5xx: true,
  }),
  REGISTER_PHONE: createRateLimiter({
    name: 'REGISTER_PHONE',
    max: 5,
    windowMs: 60 * M,
    key: phonePair,
    refund5xx: true,
  }),
  STUDENT_LOGIN: createRateLimiter({
    name: 'STUDENT_LOGIN',
    max: 600,
    windowMs: 15 * M,
    key: ip,
    refund5xx: true,
  }),
  LOGIN_IP_FAIL: createRateLimiter({
    name: 'LOGIN_IP_FAIL',
    max: 150,
    windowMs: 15 * M,
    key: ip,
    count: 'failures',
  }),
  LOGIN_ACCOUNT: createRateLimiter({
    name: 'LOGIN_ACCOUNT',
    max: 10,
    windowMs: 15 * M,
    key: phonePair,
    count: 'failures',
  }),
  LOGIN_PHONE_GLOBAL: createRateLimiter({
    name: 'LOGIN_PHONE_GLOBAL',
    max: 100,
    windowMs: 15 * M,
    key: phoneOnly,
    count: 'failures',
  }),
  CHANGE_PASSWORD: createRateLimiter({
    name: 'CHANGE_PASSWORD',
    max: 10,
    windowMs: 15 * M,
    key: user,
    count: 'failures',
  }),
  STUDENT_API: createRateLimiter({ name: 'STUDENT_API', max: 3000, windowMs: M, key: ip }),
} as const;
