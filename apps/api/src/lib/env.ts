// Created by Haihs on 11/11/2026
// Validated environment loader (port of the source app's server/config/env.js semantics).
export interface Env {
  nodeEnv: 'development' | 'test' | 'production';
  mongodbUri: string;
  jwtSecret: string;
  apiKeyEncryptionSecret: string;
  teacherSecretKey: string;
  allowInMemoryDb: boolean;
}

const MIN_SECRET = 16;
const MIN_TEACHER_KEY = 8;
// shortcut: fixed dev placeholders (public in source), source auto-generates into .dev-secrets.json; revisit in a later milestone
const DEV = {
  mongodbUri: 'mongodb://127.0.0.1:27017/doc_to_exam_db',
  jwtSecret: 'dev-only-jwt-secret-change-me',
  apiKeyEncryptionSecret: 'dev-only-encryption-secret-change-me',
  teacherSecretKey: 'dev-teacher',
};

export function loadEnv(src: Record<string, string | undefined> = process.env): Env {
  const nodeEnv = src.NODE_ENV === 'production' || src.NODE_ENV === 'test' ? src.NODE_ENV : 'development';
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
  };
}
