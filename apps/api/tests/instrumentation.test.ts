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
import { register, startup } from '../instrumentation';

let exit: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  calls.length = 0;
  exit = vi.spyOn(startup, 'exit').mockImplementation((() => undefined) as never);
  vi.stubEnv('NEXT_RUNTIME', 'nodejs');
  vi.stubEnv('NEXT_PHASE', '');
});
afterEach(() => vi.unstubAllEnvs());

describe('instrumentation.register', () => {
  it('runs loadEnv, connectDb, ensureIndexes, seedRbac once each, in order, then warms the dummy hash', async () => {
    await register();
    expect(calls).toEqual(['loadEnv', 'connectDb', 'ensureIndexes', 'seedRbac', 'compareDummy']);
    expect(exit).not.toHaveBeenCalled();
  });

  it('is idempotent when called twice (hot reload)', async () => {
    await register();
    await expect(register()).resolves.toBeUndefined();
  });

  it('production without JWT_SECRET: exits 1 once, logs the variable name only, no secret values', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', '');
    vi.stubEnv('API_KEY_ENCRYPTION_SECRET', 'super-secret-encryption-value');
    vi.stubEnv('TEACHER_SECRET_KEY', 'teacher-secret-value');
    vi.stubEnv('MONGODB_URI', 'mongodb://user:hunter2@host/db');
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await register();
    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);
    expect(errSpy).toHaveBeenCalledTimes(1);
    const logged = String(errSpy.mock.calls[0]?.join(' '));
    expect(logged).toContain('JWT_SECRET');
    for (const v of ['super-secret-encryption-value', 'teacher-secret-value', 'hunter2'])
      expect(logged).not.toContain(v);
    expect(calls).toEqual(['loadEnv']); // nothing after the failed validation
  });

  it.each(['ensureIndexes', 'seedRbac'] as const)(
    'production + raw driver error from %s: logs only Startup failed + error name, never the message',
    async (which) => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('JWT_SECRET', 'j'.repeat(20));
      vi.stubEnv('API_KEY_ENCRYPTION_SECRET', 'k'.repeat(20));
      vi.stubEnv('TEACHER_SECRET_KEY', 'teacher-key-1');
      vi.stubEnv('MONGODB_URI', 'mongodb://admin:pw123@db.internal:27017/x');
      const err = new Error(
        'mongodb://admin:pw123@db.internal:27017/x E11000 dup key: { phoneNumber: "0912345678" }',
      );
      err.name = 'MongoServerError';
      const mod =
        which === 'ensureIndexes'
          ? await import('../src/lib/ensureIndexes')
          : await import('../src/lib/rbac');
      vi.mocked(
        (mod as Record<string, unknown>)[which] as () => Promise<void>,
      ).mockRejectedValueOnce(err);
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await register();
      expect(exit).toHaveBeenCalledTimes(1);
      expect(exit).toHaveBeenCalledWith(1);
      const logged = errSpy.mock.calls.flat().map(String).join(' ');
      expect(logged).toContain('Startup failed');
      expect(logged).toContain('MongoServerError');
      for (const v of ['pw123', 'db.internal', '0912345678', 'mongodb://'])
        expect(logged).not.toContain(v);
    },
  );

  it('development + failure rethrows and does not exit', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { connectDb } = await import('../src/lib/db');
    vi.mocked(connectDb).mockRejectedValueOnce(new Error('boom'));
    await expect(register()).rejects.toThrow('boom');
    expect(exit).not.toHaveBeenCalled();
  });

  it('test env + failure rethrows and does not exit', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    const { seedRbac } = await import('../src/lib/rbac');
    vi.mocked(seedRbac).mockRejectedValueOnce(new Error('boom2'));
    await expect(register()).rejects.toThrow('boom2');
    expect(exit).not.toHaveBeenCalled();
  });

  it('is a no-op when NEXT_RUNTIME is not nodejs', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'edge');
    await register();
    expect(calls).toEqual([]);
    expect(exit).not.toHaveBeenCalled();
  });

  it('is a no-op during the production build phase', async () => {
    vi.stubEnv('NEXT_PHASE', 'phase-production-build');
    await register();
    expect(calls).toEqual([]);
    expect(exit).not.toHaveBeenCalled();
  });
});
