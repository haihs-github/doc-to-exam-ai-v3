// Created by Haihs on 11/11/2026
// Tests for instrumentation.register(): startup order, fail-fast in production, no-op outside the nodejs runtime and during build.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => [] as string[]);
vi.mock('../src/lib/db', () => ({ connectDb: vi.fn(async () => void calls.push('connectDb')) }));
vi.mock('../src/lib/ensureIndexes', () => ({
  ensureIndexes: vi.fn(async () => void calls.push('ensureIndexes')),
}));
vi.mock('../src/lib/rbac', () => ({ seedRbac: vi.fn(async () => void calls.push('seedRbac')) }));
vi.mock('../src/lib/passwordHash', () => ({
  compareDummy: vi.fn(async () => void calls.push('compareDummy')),
}));
vi.mock('../src/lib/env', async (orig) => {
  const real = await orig<typeof import('../src/lib/env')>();
  return {
    ...real,
    loadEnv: vi.fn((...a: Parameters<typeof real.loadEnv>) => {
      calls.push('loadEnv');
      return real.loadEnv(...a);
    }),
  };
});
import { register } from '../instrumentation';

beforeEach(() => {
  calls.length = 0;
  vi.stubEnv('NEXT_RUNTIME', 'nodejs');
  vi.stubEnv('NEXT_PHASE', '');
});
afterEach(() => vi.unstubAllEnvs());

describe('instrumentation.register', () => {
  it('runs loadEnv, connectDb, ensureIndexes, seedRbac once each, in order, then warms the dummy hash', async () => {
    await register();
    expect(calls).toEqual(['loadEnv', 'connectDb', 'ensureIndexes', 'seedRbac', 'compareDummy']);
  });

  it('is idempotent when called twice (hot reload)', async () => {
    await register();
    await expect(register()).resolves.toBeUndefined();
  });

  it('production without JWT_SECRET rejects naming JWT_SECRET and leaking no value', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', '');
    vi.stubEnv('API_KEY_ENCRYPTION_SECRET', 'super-secret-encryption-value');
    vi.stubEnv('TEACHER_SECRET_KEY', 'teacher-secret-value');
    vi.stubEnv('MONGODB_URI', 'mongodb://user:hunter2@host/db');
    const err = await register().then(
      () => null,
      (e: Error) => e,
    );
    expect(err?.message).toContain('JWT_SECRET');
    for (const v of ['super-secret-encryption-value', 'teacher-secret-value', 'hunter2'])
      expect(err?.message).not.toContain(v);
    expect(calls).toEqual(['loadEnv']); // nothing after the failed validation
  });

  it('is a no-op when NEXT_RUNTIME is not nodejs', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'edge');
    await register();
    expect(calls).toEqual([]);
  });

  it('is a no-op during the production build phase', async () => {
    vi.stubEnv('NEXT_PHASE', 'phase-production-build');
    await register();
    expect(calls).toEqual([]);
  });
});
