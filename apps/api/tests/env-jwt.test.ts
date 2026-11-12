// Created by Haihs on 11/11/2026
// Tests for JWT_EXPIRES_IN validation in loadEnv and its effect on real tokens.
import jwt from 'jsonwebtoken';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadEnv } from '../src/lib/env';
import { signToken } from '../src/lib/jwt';

afterEach(() => vi.unstubAllEnvs());
const exp = (v: string | undefined) => loadEnv({ JWT_EXPIRES_IN: v }).jwtExpiresIn;

describe('JWT_EXPIRES_IN', () => {
  it('defaults to 7d when unset or empty', () => {
    expect(exp(undefined)).toBe('7d');
    expect(exp('')).toBe('7d');
  });
  it('accepts durations and converts plain digits to seconds', () => {
    expect(exp('3600')).toBe(3600);
    expect(exp('7d')).toBe('7d');
    expect(exp('15m')).toBe('15m');
    expect(exp('1.5h')).toBe('1.5h');
  });
  it.each(['abc', '0', '-1', '0d', '15 minutes', '1e3'])('rejects %j naming the variable', (v) => {
    expect(() => exp(v)).toThrow(/JWT_EXPIRES_IN/);
  });
  it('a real token lives exactly the configured seconds (3600 means one hour, not 3.6s)', () => {
    vi.stubEnv('JWT_SECRET', 'test-secret-0123456789-abcdef');
    vi.stubEnv('JWT_EXPIRES_IN', '3600');
    const p = jwt.decode(signToken({ id: 'a', tokenVersion: 0 })) as jwt.JwtPayload;
    expect(p.exp! - p.iat!).toBe(3600);
  });
});
