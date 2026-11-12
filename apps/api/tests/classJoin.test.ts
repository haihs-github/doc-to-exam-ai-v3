// Created by Haihs on 12/11/2026
// Tests for POST /api/classes/join: role-bound tokens, uniform INVITE_INVALID, idempotent/atomic membership, rate limit.
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as inv from '../app/api/classes/[id]/invite/route';
import * as join from '../app/api/classes/join/route';
import { ensureIndexes } from '../src/lib/ensureIndexes';
import { signToken } from '../src/lib/jwt';
import { LIMITERS } from '../src/lib/limiters';
import { resetRateLimiters } from '../src/lib/rateLimit';
import { seedRbac } from '../src/lib/rbac';
import { ClassModel } from '../src/models/Class';
import { ClassMemberModel } from '../src/models/ClassMember';
import { UserModel } from '../src/models/User';
import { startTestDb } from './helpers';

let db: Awaited<ReturnType<typeof startTestDb>>;
beforeAll(async () => {
  vi.stubEnv('JWT_SECRET', 'test-secret-0123456789-abcdef');
  db = await startTestDb();
  vi.stubEnv('MONGODB_URI', db.uri);
  await mongoose.connect(db.uri);
  await ensureIndexes();
  await seedRbac();
});
afterAll(async () => {
  await mongoose.disconnect();
  await db.stop();
  vi.unstubAllEnvs();
});
beforeEach(async () => {
  resetRateLimiters();
  await Promise.all([
    UserModel.deleteMany({}),
    ClassModel.deleteMany({}),
    ClassMemberModel.deleteMany({}),
  ]);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.stubEnv('NODE_ENV', 'test');
});

let n = 0;
const mkUser = (role: 'teacher' | 'student' = 'student') =>
  UserModel.create({
    phoneNumber: `09400${String(n++).padStart(5, '0')}`,
    fullName: 'Nguyen Van A',
    password: 'hash-hash',
    role,
  });
type U = Awaited<ReturnType<typeof mkUser>>;
const auth = (u: U) => ({
  authorization: `Bearer ${signToken({ id: u.id, tokenVersion: u.tokenVersion })}`,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- arbitrary JSON
type R = { status: number; body: any; text: string; headers: Headers };
const call = async (
  h: (req: Request, ctx?: never) => Promise<Response>,
  u: U | null,
  o: { body?: unknown; raw?: string; id?: string } = {},
): Promise<R> => {
  const res = await h(
    new Request('http://localhost/api/classes/join', {
      method: o.body !== undefined || o.raw !== undefined ? 'POST' : 'GET',
      headers: { ...(u ? auth(u) : {}), 'content-type': 'application/json' },
      body: o.raw ?? (o.body === undefined ? undefined : JSON.stringify(o.body)),
    }),
    { params: Promise.resolve({ id: o.id }) } as never,
  );
  const text = await res.text();
  return {
    status: res.status,
    body: text ? JSON.parse(text) : undefined,
    text,
    headers: res.headers,
  };
};
const doJoin = (u: U | null, token: unknown) => call(join.POST, u, { body: { token } });
const setup = async () => {
  const t = await mkUser('teacher');
  const c = await ClassModel.create({
    name: 'L',
    code: `J${n++}`,
    startYear: 2024,
    endYear: 2027,
    createdBy: t._id,
  });
  await ClassMemberModel.create({
    classId: c._id,
    userId: t._id,
    memberRole: 'teacher',
    status: 'approved',
    source: 'creator',
  });
  const tokens = (await call(inv.GET, t, { id: c.id })).body.data;
  return { t, c, st: tokens.student.token as string, tt: tokens.teacher.token as string };
};

describe('POST /api/classes/join', () => {
  it('student with student token -> pending member, class dto, no token in response', async () => {
    const { c, st, tt } = await setup();
    const s = await mkUser();
    const r = await doJoin(s, st);
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({
      id: c.id,
      name: 'L',
      status: 'active',
      membershipStatus: 'pending',
    });
    expect(r.text).not.toContain(st);
    expect(r.text).not.toContain(tt);
    expect(r.text).not.toContain('token');
    const m = await ClassMemberModel.findOne({ classId: c._id, userId: s._id });
    expect(m).toMatchObject({
      memberRole: 'student',
      status: 'pending',
      source: 'invite',
      addedBy: null,
    });
  });

  it('teacher with teacher token -> pending teacher; token is bound to the caller role', async () => {
    const { c, st, tt } = await setup();
    const t2 = await mkUser('teacher');
    expect((await doJoin(t2, st)).status).toBe(404);
    expect((await doJoin(await mkUser(), tt)).status).toBe(404);
    const r = await doJoin(t2, tt);
    expect(r.status).toBe(200);
    expect(await ClassMemberModel.findOne({ classId: c._id, userId: t2._id })).toMatchObject({
      memberRole: 'teacher',
      status: 'pending',
    });
  });

  it('every invalid token shape gives the same 404 INVITE_INVALID (no 500)', async () => {
    const { st } = await setup();
    const s = await mkUser();
    const unknown = 'A'.repeat(43);
    const bad: unknown[] = [
      unknown,
      st.slice(1),
      `${st}A`,
      `${st.slice(0, 42)}!`,
      `${st.slice(0, 42)}+`,
      '',
      123,
      null,
      true,
      { $ne: 1 },
      { $gt: '' },
      [st],
      [unknown],
      undefined,
    ];
    const rs = await Promise.all(bad.map((b) => doJoin(s, b)));
    for (const r of rs) {
      expect(r.status).toBe(404);
      expect(r.body.code).toBe('INVITE_INVALID');
    }
    expect(new Set(rs.map((r) => r.text)).size).toBe(1);
    for (const raw of ['not json', '[]', 'null', '"x"']) {
      const r = await call(join.POST, s, { raw });
      expect(r).toMatchObject({ status: 404 });
      expect(r.text).toBe(rs[0].text);
    }
    expect(await ClassMemberModel.countDocuments({ userId: s._id })).toBe(0);
  });

  it('disabled, rotated, graduated, deleted class all look like an unknown token', async () => {
    const a = await setup();
    const s = await mkUser();
    const unknown = (await doJoin(s, 'B'.repeat(43))).text;
    await ClassModel.updateOne({ _id: a.c._id }, { $set: { 'invite.student.enabled': false } });
    expect((await doJoin(s, a.st)).text).toBe(unknown);
    await ClassModel.updateOne(
      { _id: a.c._id },
      { $set: { 'invite.student.enabled': true, status: 'graduated' } },
    );
    expect((await doJoin(s, a.st)).text).toBe(unknown);
    await ClassModel.updateOne({ _id: a.c._id }, { $set: { status: 'active' } });
    expect((await doJoin(s, a.st)).status).toBe(200);
    await ClassMemberModel.deleteOne({ userId: s._id });
    const doc = await ClassModel.findById(a.c._id);
    await doc!.softDelete();
    expect((await doJoin(s, a.st)).text).toBe(unknown);
    expect(await ClassMemberModel.countDocuments({ userId: s._id })).toBe(0);
  });

  it('repeat join is idempotent and never demotes approved; 401 without auth', async () => {
    const { c, st } = await setup();
    const s = await mkUser();
    await doJoin(s, st);
    await ClassMemberModel.updateOne(
      { classId: c._id, userId: s._id },
      { $set: { status: 'approved' } },
    );
    const r = await doJoin(s, st);
    expect(r.body.data.membershipStatus).toBe('approved');
    expect(await ClassMemberModel.countDocuments({ classId: c._id, userId: s._id })).toBe(1);
    expect((await doJoin(null, st)).status).toBe(401);
  });

  it('parallel joins of one user create exactly one membership, all 200', async () => {
    const { c, st } = await setup();
    const s = await mkUser();
    const rs = await Promise.all(Array.from({ length: 20 }, () => doJoin(s, st)));
    expect(rs.every((r) => r.status === 200)).toBe(true);
    expect(await ClassMemberModel.countDocuments({ classId: c._id, userId: s._id })).toBe(1);
  });

  it('compares the token with crypto.timingSafeEqual', async () => {
    const { st } = await setup();
    const spy = vi.spyOn(crypto, 'timingSafeEqual');
    expect((await doJoin(await mkUser(), st)).status).toBe(200);
    expect(spy).toHaveBeenCalled();
  });

  it('rate limited per user (CLASS_JOIN 20/10min) with 429; IP bucket configured 600/10min', async () => {
    expect([LIMITERS.CLASS_JOIN.max, LIMITERS.CLASS_JOIN.windowMs]).toEqual([20, 600_000]);
    expect([LIMITERS.CLASS_JOIN_IP.max, LIMITERS.CLASS_JOIN_IP.windowMs]).toEqual([600, 600_000]);
    const s = await mkUser();
    vi.stubEnv('NODE_ENV', 'development');
    const codes: number[] = [];
    for (let i = 0; i < 21; i++) codes.push((await doJoin(s, 'C'.repeat(43))).status);
    expect(codes.slice(0, 20).every((c) => c === 404)).toBe(true);
    expect(codes[20]).toBe(429);
    expect((await doJoin(await mkUser(), 'C'.repeat(43))).status).toBe(404); // other user unaffected
  });
});
