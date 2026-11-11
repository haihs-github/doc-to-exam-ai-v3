// Created by Haihs on 11/11/2026
// Tests for withAuth/withPermission/withApiKey (real in-memory MongoDB).
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ok } from '../src/lib/apiResponse';
import { withApiKey, withAuth, withPermission } from '../src/lib/auth';
import { withErrors } from '../src/lib/handler';
import { signToken } from '../src/lib/jwt';
import { seedRbac } from '../src/lib/rbac';
import { UserModel } from '../src/models/User';
import { call, startTestDb } from './helpers';

const SECRET = 'test-secret-0123456789-abcdef';
let db: Awaited<ReturnType<typeof startTestDb>>;
beforeAll(async () => {
  vi.stubEnv('JWT_SECRET', SECRET);
  vi.stubEnv('BCRYPT_COST', '4');
  db = await startTestDb();
  vi.stubEnv('MONGODB_URI', db.uri);
  await mongoose.connect(db.uri);
  await seedRbac();
});
afterAll(async () => {
  await mongoose.disconnect();
  await db.stop();
  vi.unstubAllEnvs();
});
beforeEach(async () => {
  await UserModel.deleteMany({});
});
afterEach(() => vi.restoreAllMocks());

let n = 0;
const mk = async (extra: Record<string, unknown> = {}) =>
  UserModel.create({
    phoneNumber: `09000000${String(n++).padStart(3, '0')}`,
    fullName: 'Nguyen Van A',
    password: 'hash-hash',
    role: 'teacher',
    ...extra,
  });
const tokenOf = (u: { id: string; tokenVersion: number }) =>
  signToken({ id: u.id, tokenVersion: u.tokenVersion });
const bearer = (t: string) => ({ authorization: `Bearer ${t}` });

const seen: unknown[] = [];
const inner = withErrors(
  withAuth(async (_req, ctx) => {
    seen.push(ctx);
    return ok({ id: ctx.userId });
  }),
);
beforeEach(() => (seen.length = 0));

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');

describe('withAuth', () => {
  it('passes a valid token with the right user and no password loaded', async () => {
    const u = await mk();
    const r = await call(inner, { headers: bearer(tokenOf(u)) });
    expect(r.status).toBe(200);
    expect(r.body.data.id).toBe(u.id);
    const ctx = seen[0] as { user: { id: string; password?: string }; userId: string };
    expect(ctx.user.id).toBe(u.id);
    expect(ctx.userId).toBe(u.id);
    expect(ctx.user.password).toBeUndefined();
  });

  it('preserves the Next route ctx params', async () => {
    const u = await mk();
    const res = await inner(new Request('http://localhost/x', { headers: bearer(tokenOf(u)) }), {
      params: Promise.resolve({ id: '7' }),
    });
    expect(res.status).toBe(200);
    expect(await (seen[0] as { params: Promise<unknown> }).params).toEqual({ id: '7' });
  });

  describe('rejects with 401 UNAUTHENTICATED', () => {
    const cases: [string, () => Promise<Record<string, string>>][] = [
      ['missing header', async () => ({})],
      ['Bearer without token', async () => ({ authorization: 'Bearer' })],
      ['Bearer + space only', async () => ({ authorization: 'Bearer ' })],
      ['lowercase bearer', async () => ({ authorization: `bearer ${tokenOf(await mk())}` })],
      ['Basic scheme', async () => ({ authorization: `Basic ${tokenOf(await mk())}` })],
      ['double space', async () => ({ authorization: `Bearer  ${tokenOf(await mk())}` })],
      ['extra parts', async () => ({ authorization: `Bearer ${tokenOf(await mk())} extra` })],
      [
        'other secret',
        async () => bearer(jwt.sign({ id: (await mk()).id, tv: 0 }, 'other-secret-other-secret')),
      ],
      [
        'alg none',
        async () =>
          bearer(`${b64({ alg: 'none', typ: 'JWT' })}.${b64({ id: (await mk()).id, tv: 0 })}.`),
      ],
      [
        'expired',
        async () => bearer(jwt.sign({ id: (await mk()).id, tv: 0 }, SECRET, { expiresIn: -10 })),
      ],
      ['non-ObjectId id', async () => bearer(jwt.sign({ id: 'zzz', tv: 0 }, SECRET))],
      [
        'deleted user',
        async () => {
          const u = await mk();
          const t = tokenOf(u);
          await UserModel.deleteOne({ _id: u._id });
          return bearer(t);
        },
      ],
    ];
    it.each(cases)('%s', async (_name, headers) => {
      const r = await call(inner, { headers: await headers() });
      expect(r.status).toBe(401);
      expect(r.body.code).toBe('UNAUTHENTICATED');
      expect(seen).toHaveLength(0);
    });

    it('failure causes share one body, except the revoked message', async () => {
      const u = await mk();
      const bodies = [
        (await call(inner)).body,
        (await call(inner, { headers: bearer('x.y.z') })).body,
        (
          await call(inner, {
            headers: bearer(jwt.sign({ id: u.id, tv: 0 }, 'other-secret-other-secret')),
          })
        ).body,
        (
          await call(inner, {
            headers: bearer(
              jwt.sign({ id: new mongoose.Types.ObjectId().toString(), tv: 0 }, SECRET),
            ),
          })
        ).body,
      ];
      expect(new Set(bodies.map((b) => JSON.stringify(b))).size).toBe(1);
    });

    it('stale tv gets the revoked message', async () => {
      const u = await mk({ tokenVersion: 2 });
      const r = await call(inner, { headers: bearer(signToken({ id: u.id, tokenVersion: 1 })) });
      expect(r.status).toBe(401);
      expect(r.body.code).toBe('UNAUTHENTICATED');
      expect(r.body.message).toBe('Phiên đăng nhập đã bị thu hồi. Vui lòng đăng nhập lại.');
    });

    it('newer tv than the user is rejected too', async () => {
      const u = await mk({ tokenVersion: 1 });
      const r = await call(inner, { headers: bearer(signToken({ id: u.id, tokenVersion: 2 })) });
      expect(r.status).toBe(401);
    });
  });

  it('a DB failure is a 500 INTERNAL, not a 401', async () => {
    const u = await mk();
    const t = tokenOf(u);
    vi.spyOn(UserModel, 'findById').mockImplementation(() => {
      throw new Error('db down');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await call(inner, { headers: bearer(t) });
    expect(r.status).toBe(500);
    expect(r.body.code).toBe('INTERNAL');
  });

  describe('mustChangePassword allowlist (method + exact pathname)', () => {
    const allowed: [string, string][] = [
      ['GET', '/api/auth/me'],
      ['POST', '/api/auth/change-password'],
      ['POST', '/api/auth/logout-all'],
      ['GET', '/api/auth/me/'],
      ['GET', '/api/auth/me?x=1'],
    ];
    const denied: [string, string][] = [
      ['GET', '/api/classes'],
      ['POST', '/api/auth/me'],
      ['GET', '/api/auth/me/extra'],
      ['GET', '/api/auth/mexxx'],
      ['GET', '/api/classes?next=/api/auth/me'],
      ['GET', '/api/auth/change-password'],
      ['POST', '/api/auth/logout-all/x'],
    ];
    it.each(allowed)('%s %s passes', async (method, path) => {
      const u = await mk({ mustChangePassword: true });
      const r = await call(inner, {
        method,
        url: `http://localhost${path}`,
        headers: bearer(tokenOf(u)),
      });
      expect(r.status).toBe(200);
    });
    it.each(denied)('%s %s -> 403 MUST_CHANGE_PASSWORD', async (method, path) => {
      const u = await mk({ mustChangePassword: true });
      const r = await call(inner, {
        method,
        url: `http://localhost${path}`,
        headers: bearer(tokenOf(u)),
      });
      expect(r.status).toBe(403);
      expect(r.body.code).toBe('MUST_CHANGE_PASSWORD');
      expect(seen).toHaveLength(0);
    });
    it('a normal user is not gated', async () => {
      const u = await mk();
      const r = await call(inner, {
        url: 'http://localhost/api/classes',
        headers: bearer(tokenOf(u)),
      });
      expect(r.status).toBe(200);
    });
  });
});

describe('withPermission', () => {
  const h = withErrors(withPermission('class:create', async () => ok('yes')));
  it('401 without a token', async () => {
    expect((await call(h)).status).toBe(401);
  });
  it('calls the handler when the role has the permission', async () => {
    const u = await mk();
    const r = await call(h, { headers: bearer(tokenOf(u)) });
    expect(r.status).toBe(200);
  });
  it('403 FORBIDDEN when it lacks it', async () => {
    const u = await mk({ role: 'student' });
    const r = await call(h, { headers: bearer(tokenOf(u)) });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('FORBIDDEN');
  });
});

describe('withApiKey', () => {
  const h = withErrors(withAuth(withApiKey(async () => ok('yes'))));
  it('400 REQUIRE_API_KEY without a key', async () => {
    const u = await mk();
    const r = await call(h, { headers: bearer(tokenOf(u)) });
    expect(r.status).toBe(400);
    expect(r.body).toMatchObject({ success: false, code: 'REQUIRE_API_KEY' });
    expect(typeof r.body.message).toBe('string');
  });
  it('calls the handler with a key', async () => {
    const u = await mk();
    u.setGeminiApiKey('AIza-test-key');
    await u.save();
    const r = await call(h, { headers: bearer(tokenOf(u)) });
    expect(r.status).toBe(200);
  });
});
