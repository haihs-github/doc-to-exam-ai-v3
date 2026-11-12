// Created by Haihs on 13/11/2026
// Integration: students / teachers management, temp passwords, my classes, CSV/XLSX import (parse + route).
import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as stuList from '../app/api/classes/[id]/students/route';
import * as stuOne from '../app/api/classes/[id]/students/[userId]/route';
import * as stuApprove from '../app/api/classes/[id]/students/[userId]/approve/route';
import * as stuReset from '../app/api/classes/[id]/students/[userId]/reset-password/route';
import * as stuApproveAll from '../app/api/classes/[id]/students/approve-all/route';
import * as stuSearch from '../app/api/classes/[id]/student-search/route';
import * as teachList from '../app/api/classes/[id]/teachers/route';
import * as teachOne from '../app/api/classes/[id]/teachers/[userId]/route';
import * as importRoute from '../app/api/classes/[id]/import/route';
import * as meClasses from '../app/api/me/classes/route';
import * as meClass from '../app/api/me/classes/[classId]/route';
import * as login from '../app/api/auth/student/login/route';
import { ensureIndexes } from '../src/lib/ensureIndexes';
import { parseCsv } from '../src/lib/csvParse';
import { signToken } from '../src/lib/jwt';
import { seedRbac } from '../src/lib/rbac';
import { hashPassword } from '../src/lib/passwordHash';
import { ClassModel } from '../src/models/Class';
import { ClassMemberModel } from '../src/models/ClassMember';
import { UserModel } from '../src/models/User';
import { rowsFromRecords } from '../src/services/importStudents';
import { TEMP_PASSWORD_ALPHABET, generateTempPassword } from '../src/services/tempPassword';
import { startTestDb } from './helpers';

let db: Awaited<ReturnType<typeof startTestDb>>;
beforeAll(async () => {
  vi.stubEnv('JWT_SECRET', 'test-secret-0123456789-abcdef');
  vi.stubEnv('BCRYPT_COST', '4');
  vi.stubEnv('BCRYPT_TEMP_COST', '4');
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

let n = 0;
const mkUser = (role: 'teacher' | 'student', name = 'Nguyen Van A') =>
  UserModel.create({
    phoneNumber: `09400${String(n++).padStart(5, '0')}`,
    fullName: name,
    password: 'hash-hash',
    role,
  });
type U = Awaited<ReturnType<typeof mkUser>>;
const bearer = (u: U) => ({
  authorization: `Bearer ${signToken({ id: u.id, tokenVersion: u.tokenVersion })}`,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- arbitrary JSON
type R = { status: number; body: any; headers: Headers };
type H = (req: Request, ctx?: never) => Promise<Response>;
const send = async (
  h: H,
  u: U | null,
  o: {
    method?: string;
    url?: string;
    body?: unknown;
    params?: Record<string, string>;
    form?: FormData;
  } = {},
): Promise<R> => {
  const res = await h(
    new Request(o.url ?? 'http://localhost/api/x', {
      method: o.method ?? 'GET',
      headers: {
        ...(u ? bearer(u) : {}),
        ...(o.body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: o.form ?? (o.body === undefined ? undefined : JSON.stringify(o.body)),
    }),
    { params: Promise.resolve(o.params ?? {}) } as never,
  );
  const t = await res.text();
  let body: unknown = t || undefined;
  try {
    body = t ? JSON.parse(t) : undefined;
  } catch {
    /* text */
  }
  return { status: res.status, body, headers: res.headers };
};

async function world() {
  const teacher = await mkUser('teacher', 'Giao Vien');
  const cls = await ClassModel.create({
    createdBy: teacher._id,
    name: 'L1',
    code: `C${n}`,
    startYear: 2025,
    endYear: 2026,
  });
  await ClassMemberModel.create({
    classId: cls._id,
    userId: teacher._id,
    memberRole: 'teacher',
    status: 'approved',
    source: 'creator',
  });
  return { teacher, cls, id: String(cls._id) };
}

describe('generateTempPassword', () => {
  it('10 chars from the safe alphabet, no look-alikes, roughly uniform', () => {
    expect(TEMP_PASSWORD_ALPHABET).not.toMatch(/[IO01]/);
    const counts = new Map<string, number>();
    for (let i = 0; i < 3000; i += 1) {
      const p = generateTempPassword();
      expect(p).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
      for (const c of p) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    const expected = 30000 / TEMP_PASSWORD_ALPHABET.length;
    for (const c of TEMP_PASSWORD_ALPHABET)
      expect(Math.abs((counts.get(c) ?? 0) - expected)).toBeLessThan(expected * 0.25);
  });
});

describe('students', () => {
  it('add by id/phone, list with name search, approve, rename, remove, IDOR 404, graduated class refuses', async () => {
    const { teacher, cls, id } = await world();
    const s1 = await mkUser('student', 'Nguyễn Văn An');
    const s2 = await mkUser('student', 'Trần Bình');
    const stranger = await mkUser('student');
    expect(
      (
        await send(stuList.POST, teacher, {
          method: 'POST',
          params: { id },
          body: { studentId: String(s1._id) },
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await send(stuList.POST, teacher, {
          method: 'POST',
          params: { id },
          body: { phoneNumber: s2.phoneNumber },
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await send(stuList.POST, teacher, {
          method: 'POST',
          params: { id },
          body: { studentId: String(teacher._id) },
        })
      ).body.code,
    ).toBe('STUDENT_NOT_FOUND'); // a teacher is not a student
    expect(
      (
        await send(stuList.POST, teacher, {
          method: 'POST',
          params: { id },
          body: { phoneNumber: '0123' },
        })
      ).status,
    ).toBe(400);
    const list = await send(stuList.GET, teacher, {
      params: { id },
      url: 'http://localhost/api/x?q=nguyen',
    });
    expect(list.body.data.items.map((i: { fullName: string }) => i.fullName)).toEqual([
      'Nguyễn Văn An',
    ]); // accent-less search
    expect(JSON.stringify(list.body)).not.toMatch(/password|tokenVersion/);

    const rename = await send(stuOne.PATCH, teacher, {
      method: 'PATCH',
      params: { id, userId: String(s1._id) },
      body: { fullName: 'le thi c' },
    });
    expect(rename.body.data.fullName).toBe('Le Thi C');
    expect(
      (
        await send(stuOne.PATCH, teacher, {
          method: 'PATCH',
          params: { id, userId: String(s1._id) },
          body: { fullName: '123' },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await send(stuOne.PATCH, teacher, {
          method: 'PATCH',
          params: { id, userId: String(stranger._id) },
          body: { fullName: 'Ok Ten' },
        })
      ).body.code,
    ).toBe('STUDENT_NOT_FOUND'); // not in this class

    await ClassMemberModel.create({
      classId: cls._id,
      userId: stranger._id,
      memberRole: 'student',
      status: 'pending',
      source: 'invite',
    });
    expect(
      (
        await send(stuApprove.POST, teacher, {
          method: 'POST',
          params: { id, userId: String(stranger._id) },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await send(stuOne.DELETE, teacher, {
          method: 'DELETE',
          params: { id, userId: String(stranger._id) },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await send(stuOne.DELETE, teacher, {
          method: 'DELETE',
          params: { id, userId: String(stranger._id) },
        })
      ).body.code,
    ).toBe('STUDENT_NOT_FOUND');

    // other teacher (not in the class) sees 404
    const other = await mkUser('teacher');
    expect((await send(stuList.GET, other, { params: { id } })).status).toBe(404);
    // a student cannot manage
    expect((await send(stuList.GET, s1, { params: { id } })).status).toBe(403);

    await ClassModel.updateOne({ _id: cls._id }, { status: 'graduated' });
    expect(
      (
        await send(stuList.POST, teacher, {
          method: 'POST',
          params: { id },
          body: { studentId: String(stranger._id) },
        })
      ).body.code,
    ).toBe('CLASS_NOT_ACCEPTING');
    expect(
      (await send(stuApproveAll.POST, teacher, { method: 'POST', params: { id } })).body.code,
    ).toBe('CLASS_NOT_ACCEPTING');
  });

  it('search needs >= 3 chars, only students, marks alreadyMember', async () => {
    const { teacher, cls, id } = await world();
    const s = await mkUser('student', 'Pham Quang Huy');
    await mkUser('teacher', 'Pham Quang Teacher');
    await ClassMemberModel.create({
      classId: cls._id,
      userId: s._id,
      memberRole: 'student',
      status: 'approved',
      source: 'member_add',
    });
    expect(
      (await send(stuSearch.GET, teacher, { params: { id }, url: 'http://localhost/api/x?q=ph' }))
        .status,
    ).toBe(400);
    const r = await send(stuSearch.GET, teacher, {
      params: { id },
      url: 'http://localhost/api/x?q=quang',
    });
    expect(r.body.data.items).toHaveLength(1);
    expect(r.body.data.items[0]).toMatchObject({ fullName: 'Pham Quang Huy', alreadyMember: true });
    expect(
      (
        await send(stuSearch.GET, teacher, {
          params: { id },
          url: `http://localhost/api/x?q=${s.phoneNumber.slice(0, 6)}`,
        })
      ).body.data.items[0].phoneNumber,
    ).toBe(s.phoneNumber);
  });

  it('reset password: only a student of THIS class; old session revoked; temp password works and must be changed', async () => {
    const { teacher, cls, id } = await world();
    const s = await mkUser('student', 'Le Hoa');
    await UserModel.updateOne({ _id: s._id }, { password: await hashPassword('OldPassw0rd!') });
    await ClassMemberModel.create({
      classId: cls._id,
      userId: s._id,
      memberRole: 'student',
      status: 'approved',
      source: 'member_add',
    });
    const pending = await mkUser('student');
    await ClassMemberModel.create({
      classId: cls._id,
      userId: pending._id,
      memberRole: 'student',
      status: 'pending',
      source: 'invite',
    });
    expect(
      (
        await send(stuReset.POST, teacher, {
          method: 'POST',
          params: { id, userId: String(pending._id) },
        })
      ).body.code,
    ).toBe('STUDENT_NOT_FOUND');
    expect(
      (
        await send(stuReset.POST, teacher, {
          method: 'POST',
          params: { id, userId: String(teacher._id) },
        })
      ).body.code,
    ).toBe('STUDENT_NOT_FOUND');

    const r = await send(stuReset.POST, teacher, {
      method: 'POST',
      params: { id, userId: String(s._id) },
    });
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toMatch(/no-store/);
    const temp = r.body.data.temporaryPassword as string;
    expect(temp).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
    const fresh = await UserModel.findById(s._id);
    expect(fresh).toMatchObject({ mustChangePassword: true, tokenVersion: 1 });
    // the old token is dead
    expect((await send(meClasses.GET, s)).status).toBe(401);
    const ok = await send(login.POST, null, {
      method: 'POST',
      body: { phoneNumber: s.phoneNumber, password: temp },
    });
    expect(ok.status).toBe(200);
    expect(ok.body.data.user.mustChangePassword).toBe(true);
    // never returned again
    expect(
      JSON.stringify((await send(stuList.GET, teacher, { params: { id } })).body),
    ).not.toContain(temp);
  });
});

describe('teachers and my classes', () => {
  it('last teacher can not be removed; cannot remove yourself; leave rules; students see names only', async () => {
    const { teacher, cls, id } = await world();
    const t2 = await mkUser('teacher', 'Co Hai');
    expect(
      (
        await send(teachList.POST, teacher, {
          method: 'POST',
          params: { id },
          body: { phoneNumber: t2.phoneNumber },
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await send(teachOne.DELETE, teacher, {
          method: 'DELETE',
          params: { id, userId: String(teacher._id) },
        })
      ).status,
    ).toBe(400); // yourself
    expect(
      (
        await send(teachOne.DELETE, teacher, {
          method: 'DELETE',
          params: { id, userId: String(t2._id) },
        })
      ).status,
    ).toBe(200);
    // leave as the last teacher
    const leave = await send(meClass.DELETE, teacher, {
      method: 'DELETE',
      params: { classId: id },
    });
    expect(leave.body.code).toBe('LAST_TEACHER');
    expect(await ClassMemberModel.countDocuments({ classId: cls._id, memberRole: 'teacher' })).toBe(
      1,
    );

    const s = await mkUser('student', 'Hoc Sinh Mot');
    await ClassMemberModel.create({
      classId: cls._id,
      userId: s._id,
      memberRole: 'student',
      status: 'approved',
      source: 'member_add',
    });
    const mine = await send(meClasses.GET, s);
    expect(mine.body.data[0]).toMatchObject({ id, membershipStatus: 'approved' });
    const detail = await send(meClass.GET, s, { params: { classId: id } });
    expect(detail.body.data.teachers).toEqual(['Giao Vien']);
    expect(detail.body.data.classmates).toEqual(['Hoc Sinh Mot']);
    expect(JSON.stringify(detail.body)).not.toContain(s.phoneNumber);
    const pendingStu = await mkUser('student');
    await ClassMemberModel.create({
      classId: cls._id,
      userId: pendingStu._id,
      memberRole: 'student',
      status: 'pending',
      source: 'invite',
    });
    expect((await send(meClass.GET, pendingStu, { params: { classId: id } })).status).toBe(404); // pending cannot see the roster
    expect(
      (await send(meClass.DELETE, pendingStu, { method: 'DELETE', params: { classId: id } })).body
        .message,
    ).toMatch(/hủy yêu cầu/i);
    expect(
      (await send(meClass.DELETE, s, { method: 'DELETE', params: { classId: id } })).status,
    ).toBe(200);
    expect((await send(meClass.GET, s, { params: { classId: id } })).status).toBe(404);
  });
});

describe('CSV parsing', () => {
  it('RFC 4180 basics, BOM, semicolon, quotes, CRLF, unclosed quote', () => {
    expect(parseCsv('﻿A,B\r\n"x, y","he said ""hi"""\n')).toEqual([
      ['A', 'B'],
      ['x, y', 'he said "hi"'],
    ]);
    expect(parseCsv('a;b\n1;2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(parseCsv('"open')).toBeNull();
  });
  it('rowsFromRecords: header detection, blank lines skipped, row numbers, limits', () => {
    const rows = rowsFromRecords([
      ['Họ tên', 'Số điện thoại'],
      ['', ''],
      ['An', '0912345678'],
    ]);
    expect(rows).toEqual([{ row: 3, cells: ['An', '0912345678'] }]);
    expect(() => rowsFromRecords([['', '']])).toThrow(/không có dòng dữ liệu/);
    expect(() =>
      rowsFromRecords(Array.from({ length: 201 }, (_, i) => [`N${i}`, '0912345678'])),
    ).toThrow(/Giới hạn 200/);
  });
});

describe('import route', () => {
  const upload = (u: U, id: string, file: File | null, extra: Record<string, string> = {}) => {
    const form = new FormData();
    if (file) form.append('file', file);
    for (const [k, v] of Object.entries(extra)) form.append(k, v);
    return send(importRoute.POST, u, { method: 'POST', params: { id }, form });
  };

  it('creates students with temp passwords, adds existing, flags bad/duplicate/teacher rows, stores no clear password', async () => {
    const { teacher, id } = await world();
    const existing = await mkUser('student', 'Co San');
    const otherTeacher = await mkUser('teacher', 'Giao Vien Khac');
    const csv = [
      'Họ và tên,Số điện thoại',
      'Nguyễn Văn An,0912000001',
      `Co San,${existing.phoneNumber}`,
      'Sai So,12345',
      'Trùng,0912000001',
      `Teacher,${otherTeacher.phoneNumber}`,
      '=cmd|x,0912000002',
    ].join('\n');
    const r = await upload(teacher, id, new File([csv], 'ds.csv', { type: 'text/csv' }));
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toMatch(/no-store/);
    const { summary, results } = r.body.data;
    expect(summary).toEqual({ total: 6, created: 1, added: 1, alreadyMember: 0, errors: 4 });
    const status = (rowNo: number) => results.find((x: { row: number }) => x.row === rowNo);
    expect(status(2)).toMatchObject({ status: 'created' });
    expect(status(2).temporaryPassword).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
    expect(status(3)).toMatchObject({ status: 'added' }); // existing student joins the class
    expect(status(4).status).toBe('error');
    expect(status(5).message).toMatch(/trùng trong file/);
    expect(status(6).message).toMatch(/Không thể thêm số điện thoại này/); // a teacher account, no role disclosure
    const created = await UserModel.findOne({ phoneNumber: '0912000001' });
    expect(created).toMatchObject({ role: 'student', mustChangePassword: true });
    expect(created!.password).not.toBe(status(2).temporaryPassword);
    // importing the same file again: nobody is created twice, nobody gets a new password
    const again = await upload(teacher, id, new File([csv], 'ds.csv', { type: 'text/csv' }));
    expect(again.body.data.summary.created).toBe(0);
    expect(JSON.stringify(again.body)).not.toContain(status(2).temporaryPassword);
  });

  it('refuses bad files: extension, binary csv, fake xlsx, empty, no file, > 200 rows, graduated class', async () => {
    const { teacher, cls, id } = await world();
    expect((await upload(teacher, id, null)).status).toBe(400);
    expect((await upload(teacher, id, new File(['x'], 'a.pdf'))).status).toBe(422);
    expect((await upload(teacher, id, new File(['x'], 'a.xls'))).body.message).toMatch(/\.xls/);
    expect(
      (await upload(teacher, id, new File([new Uint8Array([65, 0, 66])], 'a.csv'))).status,
    ).toBe(422);
    expect((await upload(teacher, id, new File(['not a zip'], 'a.xlsx'))).status).toBe(422);
    expect((await upload(teacher, id, new File(['Họ tên,SĐT\n'], 'a.csv'))).body.code).toBe(
      'CSV_INVALID',
    );
    const many = Array.from(
      { length: 201 },
      (_, i) => `N${i},09120${String(i).padStart(5, '0')}`,
    ).join('\n');
    expect((await upload(teacher, id, new File([many], 'a.csv'))).body.code).toBe(
      'CSV_TOO_MANY_ROWS',
    );
    const big = new File(['a'.repeat(260 * 1024)], 'a.csv');
    expect((await upload(teacher, id, big)).status).toBe(413);
    await ClassModel.updateOne({ _id: cls._id }, { status: 'graduated' });
    expect((await upload(teacher, id, new File(['An,0912000009'], 'a.csv'))).body.code).toBe(
      'CLASS_NOT_ACCEPTING',
    );
    expect(await UserModel.countDocuments({ phoneNumber: '0912000009' })).toBe(0);
  });

  it('reads a real .xlsx (phone stored as a number keeps its leading zero)', async () => {
    const { teacher, id } = await world();
    const { default: writeXlsxFile } = await import('write-excel-file/node');
    const buf = await (writeXlsxFile as unknown as (d: unknown) => { toBuffer(): Promise<Buffer> })(
      [
        [
          { value: 'Họ và tên', type: String },
          { value: 'Số điện thoại', type: String },
        ],
        [
          { value: 'Lê Xlsx', type: String },
          { value: 912000077, type: Number },
        ],
      ],
    ).toBuffer();
    const r = await upload(teacher, id, new File([new Uint8Array(buf)], 'ds.xlsx'));
    expect(r.status).toBe(200);
    expect(r.body.data.results[0]).toMatchObject({ phoneNumber: '0912000077', status: 'created' });
  });
});
