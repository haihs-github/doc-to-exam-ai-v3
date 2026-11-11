// Created by Haihs on 11/11/2026
// Tests for loadEnv: production validation, dev defaults, ALLOW_IN_MEMORY_DB rule.
import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/lib/env';

const prod = {
  NODE_ENV: 'production',
  MONGODB_URI: 'mongodb://db.example/app',
  JWT_SECRET: 'jwt-secret-value-0123456789',
  API_KEY_ENCRYPTION_SECRET: 'enc-secret-value-0123456789',
  TEACHER_SECRET_KEY: 'teacher-key-value',
};

describe('loadEnv', () => {
  it('production missing JWT_SECRET throws naming it, without leaking other secret values', () => {
    const src: Record<string, string | undefined> = { ...prod };
    delete src.JWT_SECRET;
    let msg = '';
    try {
      loadEnv(src);
    } catch (e) {
      msg = (e as Error).message;
    }
    expect(msg).toContain('JWT_SECRET');
    for (const v of Object.values(src)) expect(msg).not.toContain(v);
  });

  it('production lists every missing variable', () => {
    expect(() => loadEnv({ NODE_ENV: 'production' })).toThrow(
      /JWT_SECRET.*API_KEY_ENCRYPTION_SECRET.*TEACHER_SECRET_KEY.*MONGODB_URI/s,
    );
  });

  it('production too-short secret throws by name only', () => {
    const src = { ...prod, JWT_SECRET: 'q7Zk9' };
    expect(() => loadEnv(src)).toThrow(/JWT_SECRET/);
    expect(() => loadEnv(src)).toThrow(expect.objectContaining({ message: expect.not.stringContaining('q7Zk9') }));
  });

  it('production complete input returns the values', () => {
    const env = loadEnv(prod);
    expect(env).toMatchObject({ nodeEnv: 'production', jwtSecret: prod.JWT_SECRET, mongodbUri: prod.MONGODB_URI });
  });

  it('development with empty input does not throw and returns defaults', () => {
    const env = loadEnv({});
    expect(env.nodeEnv).toBe('development');
    expect(env.mongodbUri).toMatch(/^mongodb:\/\//);
    expect(env.jwtSecret).not.toBe('');
  });

  it('ALLOW_IN_MEMORY_DB: dev default true, dev false honoured, production always false', () => {
    expect(loadEnv({}).allowInMemoryDb).toBe(true);
    expect(loadEnv({ ALLOW_IN_MEMORY_DB: 'false' }).allowInMemoryDb).toBe(false);
    expect(loadEnv({ ...prod, ALLOW_IN_MEMORY_DB: 'true' }).allowInMemoryDb).toBe(false);
  });

  it('length boundaries in production', () => {
    expect(() => loadEnv({ ...prod, JWT_SECRET: 'x'.repeat(16) })).not.toThrow();
    expect(() => loadEnv({ ...prod, JWT_SECRET: 'x'.repeat(15) })).toThrow(/JWT_SECRET/);
    expect(() => loadEnv({ ...prod, API_KEY_ENCRYPTION_SECRET: 'x'.repeat(15) })).toThrow(/API_KEY_ENCRYPTION_SECRET/);
    expect(() => loadEnv({ ...prod, TEACHER_SECRET_KEY: 'x'.repeat(7) })).toThrow(/TEACHER_SECRET_KEY/);
    expect(() => loadEnv({ ...prod, TEACHER_SECRET_KEY: 'x'.repeat(8) })).not.toThrow();
  });

  it('nodeEnv: test stays test; unknown value behaves as development (source env.js:16-17: only exact "production"/"test" are special)', () => {
    expect(loadEnv({ NODE_ENV: 'test' }).nodeEnv).toBe('test');
    expect(loadEnv({ NODE_ENV: 'staging' }).nodeEnv).toBe('development');
  });
});
