// Created by Haihs on 12/11/2026
// Tests for /api/classes routes: create/list/get/patch/delete/restore, rollback, races, mass assignment, visibility.
import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as list from '../app/api/classes/route';
import * as one from '../app/api/classes/[id]/route';
import * as restore from '../app/api/classes/[id]/restore/route';
import { ensureIndexes } from '../src/lib/ensureIndexes';
import { signToken } from '../src/lib/jwt';
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
    phoneNumber: `09200${String(n++).padStart(5, '0')}`,
    fullName: 'Nguyen Van A',
    password: 'hash-hash',
    role,
  });
type U = Awaited<ReturnType<typeof mkUser>>;
const auth = (u: U) => ({
  authorization: `Bearer ${signToken({ id: u.id, tokenVersion: u.tokenVersion })}`,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- arbitrary JSON
type R = { status: number; body: any; headers: Headers };
const send = async (
  h: (req: Request, ctx?: never) => Promise<Response>,
  u: U,
  o: { method?: string; url?: string; body?: unknown; id?: string } = {},
): Promise<R> => {
  const res = await h(
    new Request(o.url ?? 'http://localhost/api/classes', {
      method: o.method ?? 'GET',
      headers: {
        ...auth(u),
        ...(o.body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: o.body === undefined ? undefined : JSON.stringify(o.body),
    }),
    { params: Promise.resolve({ id: o.id }) } as never,
  );
  const t = await res.text();
  return { status: res.status, body: t ? JSON.parse(t) : undefined, headers: res.headers };
};
const body = (over: Record<string, unknown> = {}) => ({
  name: '10a1',
  code: 'a1',
  startYear: 2024,
  endYear: 2027,
  ...over,
});
const create = (u: U, over: Record<string, unknown> = {}) =>
  send(list.POST, u, { method: 'POST', body: body(over) });
const listV = (u: U, qs = '') => send(list.GET, u, { url: `http://localhost/api/classes${qs}` });

describe('POST /api/classes', () => {
  it('201, upper-cases, creator is approved teacher with source creator, no token in response', async () => {
    const t = await mkUser();
    const r = await create(t);
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({
      name: '10A1',
      code: 'A1',
      startYear: 2024,
      endYear: 2027,
      status: 'active',
      studentCount: 0,
      teacherCount: 1,
    });
    expect(JSON.stringify(r.body)).not.toContain('token');
    const m = await ClassMemberModel.findOne({ classId: r.body.data.id, userId: t._id });
    expect(m).toMatchObject({ memberRole: 'teacher', status: 'approved', source: 'creator' });
  });

  it('student -> 403 (no system permission); validation -> 400; junk body -> 400', async () => {
    const s = await mkUser('student');
    const t = await mkUser();
    expect((await create(s)).status).toBe(403);
    expect((await create(t, { name: '' })).status).toBe(400);
    expect((await create(t, { startYear: 'abc' })).status).toBe(400);
    expect((await create(t, { name: { $ne: 1 } })).status).toBe(400);
    expect((await create(t, { endYear: 2040 })).status).toBe(400);
    const r = await send(list.POST, t, { method: 'POST', body: [] });
    expect(r.status).toBe(400);
    expect(await ClassModel.countDocuments({})).toBe(0);
  });

  it('duplicate code -> 409 CLASS_CODE_TAKEN field code (case/space-insensitive), no orphan', async () => {
    const t = await mkUser();
    await create(t);
    const r = await create(t, { code: ' A1 ' });
    expect(r.status).toBe(409);
    expect(r.body).toMatchObject({ code: 'CLASS_CODE_TAKEN', field: 'code' });
    expect(await ClassModel.countDocuments({})).toBe(1);
  });

  it('two parallel creates with the same code: one 201, one 409', async () => {
    const [a, b] = await Promise.all([mkUser(), mkUser()]);
    const rs = await Promise.all([create(a), create(b)]);
    expect(rs.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await ClassModel.countDocuments({})).toBe(1);
    expect(await ClassMemberModel.countDocuments({})).toBe(1);
  });

  it('rolls the class back when adding the creator fails', async () => {
    const t = await mkUser();
    vi.spyOn(ClassMemberModel, 'create').mockRejectedValueOnce(new Error('boom'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await create(t);
    expect(r.status).toBe(500);
    expect(await ClassModel.countDocuments({})).toBe(0);
  });
});

describe('GET /api/classes (list)', () => {
  it('only my classes as teacher, with counts, sorted by year desc then name', async () => {
    const [t, o] = await Promise.all([mkUser(), mkUser()]);
    const a = (await create(t, { name: 'b', code: 'B', startYear: 2023, endYear: 2026 })).body.data;
    await create(t, { name: 'a', code: 'A', startYear: 2024, endYear: 2027 });
    await create(o, { name: 'x', code: 'X' });
    const s = await mkUser('student');
    await ClassMemberModel.create({
      classId: a.id,
      userId: s._id,
      memberRole: 'student',
      status: 'approved',
      source: 'csv',
    });
    const r = await listV(t);
    expect(r.status).toBe(200);
    expect(r.body.data.items.map((c: { code: string }) => c.code)).toEqual(['A', 'B']);
    expect(r.body.data.items[1]).toMatchObject({
      studentCount: 1,
      teacherCount: 1,
      membershipStatus: 'approved',
    });
    expect(r.body.data).toMatchObject({ total: 2, page: 1, limit: 10, totalPages: 1 });
    expect(JSON.stringify(r.body)).not.toContain('token');
    expect((await listV(s)).status).toBe(403);
  });

  it('view active / graduated / deleted / all, bad view -> 400', async () => {
    const t = await mkUser();
    const ids: Record<string, string> = {};
    for (const [k, c] of Object.entries({ act: 'A', grad: 'G', del: 'D' }))
      ids[k] = (await create(t, { code: c, name: k })).body.data.id;
    await send(one.PATCH, t, { method: 'PATCH', id: ids.grad, body: { status: 'graduated' } });
    await send(one.DELETE, t, { method: 'DELETE', id: ids.del });
    const codes = async (v: string) =>
      (await listV(t, `?view=${v}`)).body.data.items.map((c: { code: string }) => c.code).sort();
    expect(await codes('active')).toEqual(['A']);
    expect(await codes('graduated')).toEqual(['G']);
    expect(await codes('deleted')).toEqual(['D']);
    expect(await codes('all')).toEqual(['A', 'D', 'G']);
    expect((await listV(t, '')).body.data.items.map((c: { code: string }) => c.code)).toEqual([
      'A',
    ]);
    const bad = await listV(t, '?view=zzz');
    expect(bad.status).toBe(400);
    expect(bad.body.field).toBe('view');
  });

  it('q filters by name/code (regex-escaped, <=50 chars) and paging caps limit at 50', async () => {
    const t = await mkUser();
    await create(t, { name: 'Toan', code: 'T.1' });
    await create(t, { name: 'Van', code: 'V1' });
    expect((await listV(t, '?q=t.1')).body.data.items).toHaveLength(1);
    expect((await listV(t, '?q=.*')).body.data.items).toHaveLength(0); // not a regex wildcard
    expect((await listV(t, `?q=${'a'.repeat(200)}`)).status).toBe(200);
    const p = await listV(t, '?limit=999&page=2');
    expect(p.body.data).toMatchObject({ limit: 50, page: 2, total: 2, items: [] });
  });

  it('a pending class shows without counts and disappears once deleted; deleted needs approved', async () => {
    const [t, p] = await Promise.all([mkUser(), mkUser()]);
    const id = (await create(t)).body.data.id;
    await ClassMemberModel.create({
      classId: id,
      userId: p._id,
      memberRole: 'teacher',
      status: 'pending',
      source: 'invite',
    });
    const r = (await listV(p)).body.data.items[0];
    expect(r).toMatchObject({ membershipStatus: 'pending', studentCount: 0 });
    await send(one.DELETE, t, { method: 'DELETE', id });
    expect((await listV(p, '?view=all')).body.data.items).toHaveLength(0);
    expect((await listV(p, '?view=deleted')).body.data.items).toHaveLength(0);
    expect((await listV(t, '?view=deleted')).body.data.items).toHaveLength(1);
  });
});

describe('GET/PATCH/DELETE /api/classes/:id', () => {
  it('GET returns detail with teachers and pending counts; invite token never present', async () => {
    const t = await mkUser();
    const id = (await create(t)).body.data.id;
    const s = await mkUser('student');
    await ClassMemberModel.create({
      classId: id,
      userId: s._id,
      memberRole: 'student',
      status: 'pending',
      source: 'invite',
    });
    const r = await send(one.GET, t, { id });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({
      id,
      pendingStudentCount: 1,
      studentCount: 0,
      teacherCount: 1,
    });
    expect(r.body.data.teachers).toEqual([
      { id: t.id, fullName: 'Nguyen Van A', phoneNumber: t.phoneNumber },
    ]);
    expect(JSON.stringify(r.body)).not.toContain('token');
  });

  it('non-member, pending, student member, bad id, unknown id all give the same 404 (GET/PATCH/DELETE/restore)', async () => {
    const [t, out, pend] = await Promise.all([mkUser(), mkUser(), mkUser()]);
    const id = (await create(t)).body.data.id;
    await ClassMemberModel.create({
      classId: id,
      userId: pend._id,
      memberRole: 'teacher',
      status: 'pending',
      source: 'invite',
    });
    const outs: R[] = [];
    for (const who of [out, pend])
      for (const i of [id, 'bad', '0'.repeat(24)]) {
        outs.push(await send(one.GET, who, { id: i }));
        outs.push(await send(one.PATCH, who, { method: 'PATCH', id: i, body: { name: 'x' } }));
        outs.push(await send(one.DELETE, who, { method: 'DELETE', id: i }));
        outs.push(await send(restore.POST, who, { method: 'POST', id: i }));
      }
    for (const o of outs) {
      expect(o.status).toBe(404);
      expect(o.body).toEqual({ success: false, code: 'NOT_FOUND', message: 'Không tìm thấy lớp.' });
    }
    expect((await ClassModel.findById(id))?.name).toBe('10A1');
  });

  it('a student member and a student outsider cannot use teacher routes (403 / 404)', async () => {
    const t = await mkUser();
    const id = (await create(t)).body.data.id;
    const [sm, so] = await Promise.all([mkUser('student'), mkUser('student')]);
    await ClassMemberModel.create({
      classId: id,
      userId: sm._id,
      memberRole: 'student',
      status: 'approved',
      source: 'csv',
    });
    expect((await send(one.GET, sm, { id })).status).toBe(403);
    expect((await send(one.DELETE, sm, { method: 'DELETE', id })).status).toBe(403);
    expect((await send(one.GET, so, { id })).status).toBe(404);
  });

  it('PATCH updates allowed fields via save(), ignores createdBy/invite/_id/deletedAt/codeKey', async () => {
    const t = await mkUser();
    const id = (await create(t)).body.data.id;
    const evil = new mongoose.Types.ObjectId().toString();
    const r = await send(one.PATCH, t, {
      method: 'PATCH',
      id,
      body: {
        name: 'lớp mới',
        code: 'b2',
        status: 'graduated',
        createdBy: evil,
        invite: { student: { token: 'x'.repeat(43) } },
        deletedAt: new Date(),
        codeKey: 'hack',
        _id: evil,
      },
    });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({
      id,
      name: 'LỚP MỚI',
      code: 'B2',
      status: 'graduated',
      deletedAt: null,
    });
    const doc = await ClassModel.findById(id).select('+invite.student.token');
    expect(String(doc?.createdBy)).toBe(t.id);
    expect(doc?.invite.student.token).toBeUndefined();
    expect(doc?.codeKey).toBe('b2');
    expect(doc?.deletedAt ?? null).toBeNull();
  });

  it('PATCH with only forbidden fields / empty / invalid -> 400; taken code -> 409 field code', async () => {
    const t = await mkUser();
    const id = (await create(t)).body.data.id;
    await create(t, { code: 'Z9', name: 'z' });
    expect(
      (await send(one.PATCH, t, { method: 'PATCH', id, body: { createdBy: 'x' } })).status,
    ).toBe(400);
    expect((await send(one.PATCH, t, { method: 'PATCH', id, body: {} })).status).toBe(400);
    expect(
      (await send(one.PATCH, t, { method: 'PATCH', id, body: { endYear: 2099 } })).status,
    ).toBe(400);
    expect(
      (await send(one.PATCH, t, { method: 'PATCH', id, body: { status: 'deleted' } })).status,
    ).toBe(400);
    const dup = await send(one.PATCH, t, { method: 'PATCH', id, body: { code: 'z9' } });
    expect(dup.status).toBe(409);
    expect(dup.body).toMatchObject({ code: 'CLASS_CODE_TAKEN', field: 'code' });
  });

  it('DELETE soft-deletes (GET then 404) and releases the code; restore with changed code', async () => {
    const t = await mkUser();
    const id = (await create(t)).body.data.id;
    const d = await send(one.DELETE, t, { method: 'DELETE', id });
    expect(d.status).toBe(200);
    expect(d.body.success).toBe(true);
    expect((await send(one.GET, t, { id })).status).toBe(404);
    expect((await create(t)).status).toBe(201); // code A1 released
    const taken = await send(restore.POST, t, { method: 'POST', id });
    expect(taken.status).toBe(409);
    expect(taken.body).toMatchObject({ code: 'CLASS_CODE_TAKEN', field: 'code' });
    expect(
      (await ClassModel.findOne({ _id: id }).setOptions({ withDeleted: true }))?.deletedAt,
    ).not.toBeNull();
    const ok = await send(restore.POST, t, { method: 'POST', id, body: { code: 'new1' } });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ id, code: 'NEW1', deletedAt: null });
    expect((await send(one.GET, t, { id })).status).toBe(200);
  });

  it('restore validates code (400 field code) and without body keeps the code', async () => {
    const t = await mkUser();
    const id = (await create(t)).body.data.id;
    await send(one.DELETE, t, { method: 'DELETE', id });
    for (const code of ['  ', 'x'.repeat(31), 5, null]) {
      const r = await send(restore.POST, t, { method: 'POST', id, body: { code } });
      expect(r.status).toBe(400);
      expect(r.body.field).toBe('code');
    }
    const r = await send(restore.POST, t, { method: 'POST', id });
    expect(r.status).toBe(200);
    expect(r.body.data.code).toBe('A1');
  });
});
