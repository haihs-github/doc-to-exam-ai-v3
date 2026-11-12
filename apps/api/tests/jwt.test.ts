// Created by Haihs on 11/11/2026
// Tests for signToken/verifyToken: HS256 only, payload {id, tv}, strict payload types.
import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signToken, verifyToken } from '../src/lib/jwt';

const SECRET = 'test-secret-0123456789-abcdef';
beforeEach(() => vi.stubEnv('JWT_SECRET', SECRET));
afterEach(() => vi.unstubAllEnvs());

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');

describe('jwt', () => {
  it('round-trips id and tv, signed HS256 with an expiry', () => {
    const t = signToken({ id: 'abc', tokenVersion: 3 });
    expect(verifyToken(t)).toMatchObject({ id: 'abc', tv: 3 });
    const d = jwt.decode(t, { complete: true })!;
    expect(d.header.alg).toBe('HS256');
    expect((d.payload as jwt.JwtPayload).exp).toBeGreaterThan(Date.now() / 1000);
  });
  it('rejects a token signed with another secret', () => {
    expect(() => verifyToken(jwt.sign({ id: 'a', tv: 0 }, 'other-secret-other-secret'))).toThrow();
  });
  it('rejects alg none', () => {
    expect(() =>
      verifyToken(`${b64({ alg: 'none', typ: 'JWT' })}.${b64({ id: 'a', tv: 0 })}.`),
    ).toThrow();
  });
  it('rejects another algorithm (HS512) even with the right secret', () => {
    expect(() =>
      verifyToken(jwt.sign({ id: 'a', tv: 0 }, SECRET, { algorithm: 'HS512' })),
    ).toThrow();
  });
  it('rejects an expired token', () => {
    expect(() => verifyToken(jwt.sign({ id: 'a', tv: 0 }, SECRET, { expiresIn: -10 }))).toThrow();
  });
  it.each([
    [{ id: 1, tv: 0 }],
    [{ id: 'a', tv: '0' }],
    [{ id: 'a' }],
    [{ tv: 0 }],
    [{ id: 'a', tv: 1.5 }],
    [{ id: '', tv: 0 }],
    [{ id: { $ne: 1 }, tv: 0 }],
  ])('rejects malformed payload %j', (payload) => {
    expect(() => verifyToken(jwt.sign(payload, SECRET))).toThrow();
  });
  it('rejects garbage', () => {
    expect(() => verifyToken('not.a.jwt')).toThrow();
    expect(() => verifyToken('')).toThrow();
  });
});
