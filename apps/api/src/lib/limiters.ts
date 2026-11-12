// Created by Haihs on 11/11/2026
// Rate-limit buckets of the account endpoints (values from backend inventory 1.4, source server/middlewares/rateLimit.js).
import { clientIp } from './clientIp';
import { readTrustProxy } from './env';
import { readJson } from './handler';
import { normalizePhone, PHONE_RE } from './phone'; // Haihs: dùng chung hàm chuẩn hóa và PHONE_RE với handler đăng nhập/đăng ký - start - end
import { createRateLimiter, type RateLimiterOptions } from './rateLimit';

const M = 60_000;
// Re-read only when the raw env changes (cheap, no loadEnv: a missing production secret must not turn limiters into 500s).
let tpRaw: string | undefined;
let tp = 0;
const rawIp = (req: Request) => {
  const raw = `${process.env.NODE_ENV}|${process.env.TRUST_PROXY}`;
  if (raw !== tpRaw) {
    tpRaw = raw;
    tp = readTrustProxy();
  }
  return clientIp(req, tp);
};
const ip = (req: Request) => `ip:${rawIp(req)}`.slice(0, 64);

// Phone is attacker-controlled: it only becomes part of a key when it matches the VN format (after trim and
// stripping space . -); otherwise the key is IP-only, so keys stay <= 64 chars and cannot be used to bloat memory.
// TODO(api): Task 7 — handler phải trả 400 VALIDATION cho sdt không khớp regex TRƯỚC bcrypt/đăng ký (phone bucket bỏ qua sdt sai định dạng)
// Haihs: Task 7 đã xử lý — parsePhone (authValidation.ts) trả 400 trước bcrypt/đăng ký; chuẩn hóa dùng lib/phone.ts - start - end
// const PHONE_RE = /^0\d{9,10}$/; // Haihs: đóng code cũ, PHONE_RE chuyển sang lib/phone.ts để dùng chung - start - end
// The body is read from a clone (cached per request), so the route handler can still read the original.
const phones = new WeakMap<Request, Promise<string>>();
function phoneOf(req: Request): Promise<string> {
  let p = phones.get(req);
  if (!p) {
    p = readJson(req.clone())
      .then((b) => {
        // Haihs: dùng normalizePhone dùng chung với handler đăng nhập/đăng ký - start
        // đóng code cũ
        // const raw = (b as { phoneNumber?: unknown } | null)?.phoneNumber;
        // if (typeof raw !== 'string' || raw.length > 32) return '';
        // const phone = raw.trim().replace(/[\s.-]/g, '');
        const phone = normalizePhone((b as { phoneNumber?: unknown } | null)?.phoneNumber);
        // Haihs: dùng normalizePhone dùng chung với handler đăng nhập/đăng ký - end
        return PHONE_RE.test(phone) ? phone : '';
      })
      .catch(() => '');
    phones.set(req, p);
  }
  return p;
}
const phonePair: RateLimiterOptions['key'] = async (req) => {
  const phone = await phoneOf(req);
  return phone ? `p:${phone}|${rawIp(req)}`.slice(0, 64) : ip(req);
};
const phoneOnly: RateLimiterOptions['key'] = async (req) => {
  const phone = await phoneOf(req);
  return phone ? `p:${phone}` : ip(req);
};
// Task 7 puts withRateLimit INSIDE the auth wrapper, which passes the user as ctx.userId; unauthenticated falls back to IP.
const user: RateLimiterOptions['key'] = (req, ctx) =>
  ctx?.userId ? `u:${ctx.userId}`.slice(0, 64) : ip(req);

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
  // Haihs: giới hạn join lớp theo nguồn (CLASS_JOIN 20/10p user, CLASS_JOIN_IP 600/10p IP) - start
  CLASS_JOIN_IP: createRateLimiter({ name: 'CLASS_JOIN_IP', max: 600, windowMs: 10 * M, key: ip }),
  CLASS_JOIN: createRateLimiter({ name: 'CLASS_JOIN', max: 20, windowMs: 10 * M, key: user }),
  // Haihs: giới hạn join lớp theo nguồn (CLASS_JOIN 20/10p user, CLASS_JOIN_IP 600/10p IP) - end
  // Haihs: limiter tìm/thêm thành viên, đặt lại mật khẩu, import (nguồn rateLimit.js, theo user) - start
  MEMBER_SEARCH: createRateLimiter({ name: 'MEMBER_SEARCH', max: 60, windowMs: 10 * M, key: user }),
  MEMBER_SEARCH_DAY: createRateLimiter({
    name: 'MEMBER_SEARCH_DAY',
    max: 500,
    windowMs: 24 * 60 * M,
    key: user,
  }),
  MEMBER_LOOKUP: createRateLimiter({ name: 'MEMBER_LOOKUP', max: 200, windowMs: 10 * M, key: user }),
  CSV_IMPORT: createRateLimiter({ name: 'CSV_IMPORT', max: 10, windowMs: 10 * M, key: user }),
  RESET_PASSWORD: createRateLimiter({
    name: 'RESET_PASSWORD',
    max: 100,
    windowMs: 10 * M,
    key: user,
    refund5xx: true,
  }),
  // Haihs: limiter tìm/thêm thành viên, đặt lại mật khẩu, import - end
  // Haihs: limiter nhân bản đề mẫu (nguồn: DUPLICATE_RATE_MAX/WINDOW_MS, mặc định 10/phút theo user) - start
  DUPLICATE: createRateLimiter({ name: 'DUPLICATE', max: 10, windowMs: M, key: user }),
  // Haihs: limiter nhân bản đề mẫu - end
  // Haihs: limiter tách đề bằng AI (tốn quota Gemini, theo user: 10 lần/10 phút) - start
  TEACHER_UPLOAD: createRateLimiter({ name: 'TEACHER_UPLOAD', max: 10, windowMs: 10 * M, key: user }),
  // Haihs: limiter tách đề bằng AI - end
  // Haihs: limiter luồng ca thi của học sinh (nguồn rateLimit.js: resolve chỉ lần sai; start/submit hoàn lượt khi 5xx) - start
  SITTING_RESOLVE: createRateLimiter({ name: 'SITTING_RESOLVE', max: 20, windowMs: 10 * M, key: user, count: 'failures' }),
  SITTING_RESOLVE_IP: createRateLimiter({ name: 'SITTING_RESOLVE_IP', max: 300, windowMs: 10 * M, key: ip, count: 'failures' }),
  SITTING_START: createRateLimiter({ name: 'SITTING_START', max: 400, windowMs: M, key: ip, refund5xx: true }),
  SITTING_START_USER: createRateLimiter({ name: 'SITTING_START_USER', max: 30, windowMs: M, key: user, refund5xx: true }),
  SITTING_SUBMIT: createRateLimiter({ name: 'SITTING_SUBMIT', max: 400, windowMs: M, key: ip, refund5xx: true }),
  SITTING_SUBMIT_USER: createRateLimiter({ name: 'SITTING_SUBMIT_USER', max: 10, windowMs: M, key: user, refund5xx: true }),
  RESULT_VIEW: createRateLimiter({ name: 'RESULT_VIEW', max: 400, windowMs: M, key: ip, refund5xx: true }),
  RESULT_VIEW_USER: createRateLimiter({ name: 'RESULT_VIEW_USER', max: 30, windowMs: M, key: user, refund5xx: true }),
  // Haihs: limiter luồng ca thi của học sinh - end
  // Haihs: limiter upload tự luận (nguồn essayUploadRoutes.js: IP 1200/phút, token sai 30/phút theo IP, 12 lượt/phút theo phiên) - start
  ESSAY_UPLOAD_IP: createRateLimiter({ name: 'ESSAY_UPLOAD_IP', max: 1200, windowMs: M, key: ip, refund5xx: true }),
  ESSAY_UPLOAD_BAD: createRateLimiter({ name: 'ESSAY_UPLOAD_BAD', max: 30, windowMs: M, key: ip, count: 'failures' }),
  ESSAY_UPLOAD_SESSION: createRateLimiter({
    name: 'ESSAY_UPLOAD_SESSION',
    max: 12,
    windowMs: M,
    key: (req) => {
      const t = req.headers.get('x-upload-token') ?? '';
      return /^[0-9a-f]{48}$/.test(t) ? `s:${t}` : null; // a malformed token is refused later; never becomes a key
    },
    refund5xx: true,
  }),
  // Haihs: limiter upload tự luận - end
} as const;
