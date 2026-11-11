// Created by Haihs on 11/11/2026
// Validated environment loader (port of the source app's server/config/env.js semantics).
import { randomBytes } from 'node:crypto';

export interface Env {
  nodeEnv: 'development' | 'test' | 'production';
  mongodbUri: string;
  jwtSecret: string;
  apiKeyEncryptionSecret: string;
  teacherSecretKey: string;
  allowInMemoryDb: boolean;
  trustProxy: number; // Haihs: số proxy tin cậy phía trước app (X-Forwarded-For), dùng cho rate limit - start - end
}

const MIN_SECRET = 16;
const MIN_TEACHER_KEY = 8;
// Dev/test secrets are random per process (never public constants); cached so loadEnv is stable within a process.
// shortcut: not persisted across restarts (source writes .dev-secrets.json), so dev tokens die on restart; revisit if that hurts
const rand = () => randomBytes(32).toString('hex');
const DEV = {
  mongodbUri: 'mongodb://127.0.0.1:27017/doc_to_exam_db',
  jwtSecret: rand(),
  apiKeyEncryptionSecret: rand(),
  teacherSecretKey: rand(),
};

export function loadEnv(src: Record<string, string | undefined> = process.env): Env {
  // Only exact development/test (or unset/empty) are relaxed; any other value (staging, typos) gets production rules.
  const raw = src.NODE_ENV;
  const nodeEnv: Env['nodeEnv'] = raw === 'test' ? 'test' : !raw || raw === 'development' ? 'development' : 'production';
  const get = (k: string) => (src[k] ?? '').trim();
  const isProd = nodeEnv === 'production';

  const jwtSecret = get('JWT_SECRET');
  const apiKeyEncryptionSecret = get('API_KEY_ENCRYPTION_SECRET');
  const teacherSecretKey = get('TEACHER_SECRET_KEY');
  const mongodbUri = get('MONGODB_URI');

  if (isProd) {
    // names only: never put a value in the message
    const checks: [string, string, number][] = [
      ['JWT_SECRET', jwtSecret, MIN_SECRET],
      ['API_KEY_ENCRYPTION_SECRET', apiKeyEncryptionSecret, MIN_SECRET],
      ['TEACHER_SECRET_KEY', teacherSecretKey, MIN_TEACHER_KEY],
      ['MONGODB_URI', mongodbUri, 1],
    ];
    const bad = checks.filter(([, v, min]) => v.length < min).map(([k]) => k);
    if (bad.length) throw new Error(`Invalid environment: missing or too short: ${bad.join(', ')}`);
  }

  return {
    nodeEnv,
    mongodbUri: mongodbUri || DEV.mongodbUri,
    jwtSecret: jwtSecret || DEV.jwtSecret,
    apiKeyEncryptionSecret: apiKeyEncryptionSecret || DEV.apiKeyEncryptionSecret,
    teacherSecretKey: teacherSecretKey || DEV.teacherSecretKey,
    // in-memory DB loses data: never outside dev/test (source env.js:164-166, hardened for production)
    allowInMemoryDb: !isProd && get('ALLOW_IN_MEMORY_DB') !== 'false',
    trustProxy: readTrustProxy(src), // Haihs: trust proxy mặc định 1 ở production, 0 nơi khác - start - end
  };
}

// Haihs: đọc TRUST_PROXY không cần loadEnv (không đòi secret production) - start
// Non-negative integer; anything else falls back to 1 in production, 0 elsewhere.
export function readTrustProxy(src: Record<string, string | undefined> = process.env): number {
  const raw = (src.TRUST_PROXY ?? '').trim();
  const v = Number(raw);
  if (raw !== '' && Number.isInteger(v) && v >= 0) return v;
  const e = src.NODE_ENV;
  return e && e !== 'development' && e !== 'test' ? 1 : 0;
}
// Haihs: đọc TRUST_PROXY không cần loadEnv (không đòi secret production) - end

// Haihs: ghi đè ngưỡng rate limit bằng RATE_LIMIT_<NAME>_MAX - start
// Positive integer only; anything else is ignored (source rateLimit.js resolveMax).
export function rateLimitMax(name: string, fallback: number, src: Record<string, string | undefined> = process.env): number {
  const v = Number(src[`RATE_LIMIT_${name}_MAX`]);
  return Number.isInteger(v) && v > 0 ? v : fallback;
}
// Haihs: ghi đè ngưỡng rate limit bằng RATE_LIMIT_<NAME>_MAX - end
