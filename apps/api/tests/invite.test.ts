// Created by Haihs on 12/11/2026
// Tests for invite token generation and GET/rotate/PATCH /api/classes/:id/invite routes (visibility, rotation, enable flag).
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as inv from '../app/api/classes/[id]/invite/route';
import * as rot from '../app/api/classes/[id]/invite/[kind]/rotate/route';
import * as kindRoute from '../app/api/classes/[id]/invite/[kind]/route';
import * as join from '../app/api/classes/join/route';
import { ensureIndexes } from '../src/lib/ensureIndexes';
import { signToken } from '../src/lib/jwt';
import { seedRbac } from '../src/lib/rbac';
import { ClassModel } from '../src/models/Class';
import { ClassMemberModel } from '../src/models/ClassMember';
import { UserModel } from '../src/models/User';
import { newInviteToken } from '../src/services/invite';
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
  await Promise.all([
    UserModel.deleteMany({}),
    ClassModel.deleteMany({}),
    ClassMemberModel.deleteMany({}),
  ]);
});
afterEach(() => vi.restoreAllMocks());

let n = 0;
const mkUser = (role: 'teacher' | 'student' = 'teacher') =>
  UserModel.create({
    phoneNumber: `09300${String(n++).padStart(5, '0')}`,
    fullName: 'Nguyen Van A',
    password: 'hash-hash',
    role,
  });
type U = Awaited<ReturnType<typeof mkUser>>;
const auth = (u: U) => ({
  authorization: `Bearer ${signToken({ id: u.id, tokenVersion: u.tokenVersion })}`,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- arbitrary JSON
type R = { status: number; body: any; headers: Headers; text: string };
const send = async (
  h: (req: Request, ctx?: never) => Promise<Response>,
  u: U,
  o: { method?: string; body?: unknown; id?: string; kind?: string } = {},
): Promise<R> => {
  const res = await h(
    new Request('http://localhost/api/classes/x', {
      method: o.method ?? 'GET',
      headers: {
        ...auth(u),
        ...(o.body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: o.body === undefined ? undefined : JSON.stringify(o.body),
    }),
    { params: Promise.resolve({ id: o.id, kind: o.kind }) } as never,
  );
  const text = await res.text();
  return {
    status: res.status,
    body: text ? JSON.parse(text) : undefined,
    headers: res.headers,
    text,
  };
};
const mkClass = async (teacher: U, over: Record<string, unknown> = {}) => {
  const c = await ClassModel.create({
    name: 'L',
    code: `C${n++}`,
    startYear: 2024,
    endYear: 2027,
    createdBy: teacher._id,
    ...over,
  });
  await ClassMemberModel.create({
    classId: c._id,
    userId: teacher._id,
    memberRole: 'teacher',
    status: 'approved',
    source: 'creator',
  });
  return c;
};
const getInvite = (u: U, id: string) => send(inv.GET, u, { id });
const doJoin = (u: U, token: unknown) => send(join.POST, u, { method: 'POST', body: { token } });
const rotate = (u: U, id: string, kind: string) => send(rot.POST, u, { method: 'POST', id, kind });
const setEnabled = (u: U, id: string, kind: string, body: unknown) =>
  send(kindRoute.PATCH, u, { method: 'PATCH', id, kind, body });
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

describe('newInviteToken', () => {
  it('43 base64url chars from 32 CSPRNG bytes, unique', () => {
    const spy = vi.spyOn(crypto, 'randomBytes');
    const t = newInviteToken();
    expect(t).toMatch(TOKEN_RE);
    expect(spy).toHaveBeenCalledWith(32);
    spy.mockRestore();
    expect(new Set(Array.from({ length: 2000 }, newInviteToken)).size).toBe(2000);
  });
});

describe('GET /api/classes/:id/invite', () => {
  it('teacher gets both tokens, no-store, stable across calls and parallel first reads', async () => {
    const t = await mkUser();
    const c = await mkClass(t);
    const [a, b] = await Promise.all([getInvite(t, c.id), getInvite(t, c.id)]);
    expect(a.status).toBe(200);
    expect(a.headers.get('cache-control')).toBe('no-store');
    const d = a.body.data;
    expect(d.student.token).toMatch(TOKEN_RE);
    expect(d.teacher.token).toMatch(TOKEN_RE);
    expect(d.student.token).not.toBe(d.teacher.token);
    expect(d.student.enabled).toBe(true);
    expect(typeof d.student.rotatedAt).toBe('string');
    expect(b.body.data).toEqual(d);
    expect((await getInvite(t, c.id)).body.data).toEqual(d);
    // stored once: the DB holds exactly what was returned
    const raw = await ClassModel.findById(c._id).select(
      '+invite.student.token +invite.teacher.token',
    );
    expect(raw?.invite.student.token).toBe(d.student.token);
  });

  it('student (approved) 403, pending student and outsider 404; no token in any body', async () => {
    const t = await mkUser();
    const c = await mkClass(t);
    const s = await mkUser('student');
    const p = await mkUser('student');
    const o = await mkUser('student');
    await ClassMemberModel.create({
      classId: c._id,
      userId: s._id,
      memberRole: 'student',
      status: 'approved',
      source: 'member_add',
    });
    await ClassMemberModel.create({
      classId: c._id,
      userId: p._id,
      memberRole: 'student',
      status: 'pending',
      source: 'invite',
    });
    const real = (await getInvite(t, c.id)).body.data;
    const rs = await Promise.all([s, p, o].map((u) => getInvite(u, c.id)));
    expect(rs.map((r) => r.status)).toEqual([403, 404, 404]);
    for (const r of rs) {
      expect(r.text).not.toContain(real.student.token);
      expect(r.text).not.toContain(real.teacher.token);
    }
    expect(rs[1].body).toEqual(rs[2].body);
  });

  it('deleted class and malformed id -> 404', async () => {
    const t = await mkUser();
    const c = await mkClass(t);
    await c.softDelete();
    expect((await getInvite(t, c.id)).status).toBe(404);
    expect((await getInvite(t, 'zzz')).status).toBe(404);
  });
});

describe('rotate', () => {
  it('invalidates the old token at once and only for that kind', async () => {
    const t = await mkUser();
    const c = await mkClass(t);
    const before = (await getInvite(t, c.id)).body.data;
    const s = await mkUser('student');
    const r = await rotate(t, c.id, 'student');
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(r.body.data.student.token).toMatch(TOKEN_RE);
    expect(r.body.data.student.token).not.toBe(before.student.token);
    expect(r.body.data.teacher.token).toBe(before.teacher.token);
    expect((await doJoin(s, before.student.token)).status).toBe(404);
    expect((await doJoin(s, r.body.data.student.token)).status).toBe(200);
    const t2 = await mkUser();
    expect((await doJoin(t2, before.teacher.token)).status).toBe(200);
  });

  it('rotate with no tokens yet still issues a valid token; bad kind 400; student 403; outsider 404', async () => {
    const t = await mkUser();
    const c = await mkClass(t);
    expect((await rotate(t, c.id, 'teacher')).body.data.teacher.token).toMatch(TOKEN_RE);
    for (const k of ['admin', 'Student', '$ne', 'student/x'])
      expect((await rotate(t, c.id, k)).status).toBe(400);
    const s = await mkUser('student');
    const o = await mkUser();
    await ClassMemberModel.create({
      classId: c._id,
      userId: s._id,
      memberRole: 'student',
      status: 'approved',
      source: 'member_add',
    });
    expect((await rotate(s, c.id, 'student')).status).toBe(403);
    expect((await rotate(o, c.id, 'student')).status).toBe(404);
  });
});

describe('PATCH enabled', () => {
  it('false blocks join of that kind only; true restores; token unchanged', async () => {
    const t = await mkUser();
    const c = await mkClass(t);
    const tok = (await getInvite(t, c.id)).body.data;
    const s = await mkUser('student');
    const off = await setEnabled(t, c.id, 'student', { enabled: false });
    expect(off.status).toBe(200);
    expect(off.headers.get('cache-control')).toBe('no-store');
    expect(off.body.data.student).toMatchObject({ enabled: false, token: tok.student.token });
    expect(off.body.data.teacher.enabled).toBe(true);
    expect((await doJoin(s, tok.student.token)).status).toBe(404);
    expect((await doJoin(await mkUser(), tok.teacher.token)).status).toBe(200);
    await setEnabled(t, c.id, 'student', { enabled: true });
    expect((await doJoin(s, tok.student.token)).status).toBe(200);
  });

  it('non-boolean 400; bad kind 400; student member 403', async () => {
    const t = await mkUser();
    const c = await mkClass(t);
    for (const b of [
      {},
      { enabled: 'false' },
      { enabled: 0 },
      { enabled: null },
      { enabled: { $ne: 1 } },
      [],
    ])
      expect((await setEnabled(t, c.id, 'student', b)).status).toBe(400);
    expect((await setEnabled(t, c.id, 'x', { enabled: true })).status).toBe(400);
    const s = await mkUser('student');
    await ClassMemberModel.create({
      classId: c._id,
      userId: s._id,
      memberRole: 'student',
      status: 'approved',
      source: 'member_add',
    });
    expect((await setEnabled(s, c.id, 'student', { enabled: false })).status).toBe(403);
  });
});
