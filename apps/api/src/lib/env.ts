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
  hasMongoUri: boolean; // Haihs: phân biệt URI do người dùng cấu hình với URI mặc định dev - start - end
  // jwtExpiresIn: string; // Haihs: thời hạn token đăng nhập (JWT_EXPIRES_IN, mặc định 7d) - start - end // đóng code cũ, số thuần là giây nên kiểu string | number
  jwtExpiresIn: string | number; // Haihs: JWT_EXPIRES_IN dạng số là giây nên kiểu number - start - end
  enableTeacherSecret: boolean; // Haihs: ENABLE_TEACHER_SECRET (mặc định false): true mới bắt nhập mã bí mật khi đăng ký giáo viên - start - end
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

  const enableTeacherSecret = get('ENABLE_TEACHER_SECRET').toLowerCase() === 'true'; // Haihs: chỉ đúng chuỗi 'true' mới bật, mặc định false - start - end

  if (isProd) {
    // names only: never put a value in the message
    const checks: [string, string, number][] = [
      ['JWT_SECRET', jwtSecret, MIN_SECRET],
      ['API_KEY_ENCRYPTION_SECRET', apiKeyEncryptionSecret, MIN_SECRET],
      // ['TEACHER_SECRET_KEY', teacherSecretKey, MIN_TEACHER_KEY], // Haihs: đóng code cũ, chỉ bắt buộc khi ENABLE_TEACHER_SECRET=true - start - end
      ['MONGODB_URI', mongodbUri, 1],
    ];
    // Haihs: TEACHER_SECRET_KEY chỉ bắt buộc khi bật ENABLE_TEACHER_SECRET - start
    if (enableTeacherSecret) checks.splice(2, 0, ['TEACHER_SECRET_KEY', teacherSecretKey, MIN_TEACHER_KEY]);
    // Haihs: TEACHER_SECRET_KEY chỉ bắt buộc khi bật ENABLE_TEACHER_SECRET - end
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
    hasMongoUri: mongodbUri !== '', // Haihs: phân biệt URI do người dùng cấu hình với URI mặc định dev - start - end
    // jwtExpiresIn: get('JWT_EXPIRES_IN') || '7d', // Haihs: thời hạn token đăng nhập, mặc định 7d như nguồn - start - end // đóng code cũ, validate (số thuần bị jsonwebtoken đọc là mili giây)
    jwtExpiresIn: readJwtExpiresIn(get('JWT_EXPIRES_IN')), // Haihs: validate JWT_EXPIRES_IN (số thuần bị jsonwebtoken đọc là mili giây) - start - end
    enableTeacherSecret, // Haihs: ENABLE_TEACHER_SECRET - start - end
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

// Haihs: validate JWT_EXPIRES_IN - start
// '' -> 7d; plain digits = seconds (jsonwebtoken would read a bare string number as ms); otherwise "<n><unit>". Must be > 0.
function readJwtExpiresIn(raw: string): string | number {
  if (raw === '') return '7d';
  if (/^\d+$/.test(raw) && Number(raw) > 0) return Number(raw);
  if (/^\d+(\.\d+)?\s*(ms|s|m|h|d|w|y)$/i.test(raw) && parseFloat(raw) > 0) return raw;
  throw new Error('Invalid environment: JWT_EXPIRES_IN must be a positive number of seconds or a duration like 15m, 7d');
}
// Haihs: validate JWT_EXPIRES_IN - end
