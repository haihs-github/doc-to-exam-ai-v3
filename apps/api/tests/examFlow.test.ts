// Created by Haihs on 13/11/2026
// Integration (in-memory Mongo, route handlers): templates -> sitting -> student takes it -> essay upload -> grading -> publication -> result.
import mongoose, { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as tplList from '../app/api/templates/route';
import * as tplOne from '../app/api/templates/[id]/route';
import * as tplDup from '../app/api/templates/[id]/duplicate/route';
import * as tplRestore from '../app/api/templates/[id]/restore/route';
import * as tplPurge from '../app/api/templates/[id]/purge/route';
import * as sitList from '../app/api/sittings/route';
import * as sitOne from '../app/api/sittings/[id]/route';
import * as sitGrants from '../app/api/sittings/[id]/grants/route';
import * as sitRevoke from '../app/api/sittings/[id]/grants/revoke/route';
import * as sitCode from '../app/api/sittings/[id]/regenerate-code/route';
import * as sitResults from '../app/api/sittings/[id]/results/route';
import * as sitPublish from '../app/api/sittings/[id]/results/publish/route';
import * as sitUnpublish from '../app/api/sittings/[id]/results/unpublish/route';
import * as sitGrade from '../app/api/sittings/[id]/submissions/[submissionId]/essay/[questionId]/route';
import * as meList from '../app/api/me/sittings/route';
import * as meResolve from '../app/api/me/sittings/resolve/route';
import * as meStart from '../app/api/me/sittings/[sittingId]/start/route';
import * as meSubmit from '../app/api/me/sittings/[sittingId]/submit/route';
import * as meResult from '../app/api/me/sittings/[sittingId]/result/route';
import * as upload from '../app/api/essay-uploads/route';
import { ensureIndexes } from '../src/lib/ensureIndexes';
import { signToken } from '../src/lib/jwt';
import { seedRbac } from '../src/lib/rbac';
import { ClassModel } from '../src/models/Class';
import { ClassMemberModel } from '../src/models/ClassMember';
import { ExamSittingModel } from '../src/models/ExamSitting';
import { ExamTemplateModel } from '../src/models/ExamTemplate';
import { SittingGrantModel } from '../src/models/SittingGrant';
import { SittingSessionModel } from '../src/models/SittingSession';
import { SittingSubmissionModel } from '../src/models/SittingSubmission';
import { UserModel } from '../src/models/User';
import { settlePendingSessionCleanups } from '../src/services/meSittings';
import { startTestDb } from './helpers';

let db: Awaited<ReturnType<typeof startTestDb>>;
beforeAll(async () => {
  vi.stubEnv('JWT_SECRET', 'test-secret-0123456789-abcdef');
  vi.stubEnv('EXAM_CACHE_TTL_MS', '0'); // no cache: tests change sittings between calls
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
  await settlePendingSessionCleanups();
  await Promise.all([
    UserModel.deleteMany({}),
    ClassModel.deleteMany({}),
    ClassMemberModel.deleteMany({}),
    ExamTemplateModel.deleteMany({}),
    ExamSittingModel.deleteMany({}),
    SittingGrantModel.deleteMany({}),
    SittingSessionModel.deleteMany({}),
    SittingSubmissionModel.deleteMany({}),
  ]);
});

let n = 0;
const mkUser = (role: 'teacher' | 'student') =>
  UserModel.create({
    phoneNumber: `09300${String(n++).padStart(5, '0')}`,
    fullName: role === 'teacher' ? 'Giao Vien' : `Hoc Sinh ${n}`,
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
  u: U,
  o: {
    method?: string;
    url?: string;
    body?: unknown;
    params?: Record<string, string>;
    headers?: Record<string, string>;
  } = {},
): Promise<R> => {
  const res = await h(
    new Request(o.url ?? 'http://localhost/api/x', {
      method: o.method ?? 'GET',
      headers: {
        ...bearer(u),
        ...(o.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...o.headers,
      },
      body: o.body === undefined ? undefined : JSON.stringify(o.body),
    }),
    { params: Promise.resolve(o.params ?? {}) } as never,
  );
  const t = await res.text();
  let body: unknown = t || undefined;
  try {
    body = t ? JSON.parse(t) : undefined;
  } catch {
    /* binary / text */
  }
  return { status: res.status, body, headers: res.headers };
};

const questions = () => [
  {
    id: 1,
    questionText: 'q1',
    options: { A: 'a', B: 'b', C: 'c', D: 'd' },
    correctAnswer: 'B',
    explanation: 'because',
  },
  {
    id: 2,
    questionText: 'q2',
    options: { A: 'a', B: 'b', C: 'c', D: 'd' },
    correctAnswer: 'A',
    explanation: '',
  },
];
const essayQ = () => ({
  id: 3,
  type: 'essay',
  questionText: 'Write',
  rubric: [
    { key: 'k1', label: 'One', max: 1 },
    { key: 'k2', label: 'Two', max: 1.5 },
  ],
  maxScore: 2.5,
});

async function world() {
  const teacher = await mkUser('teacher');
  const student = await mkUser('student');
  const cls = await ClassModel.create({
    createdBy: teacher._id,
    name: 'L1',
    code: `C${n}`,
    startYear: 2025,
    endYear: 2026,
  });
  await ClassMemberModel.create([
    {
      classId: cls._id,
      userId: teacher._id,
      memberRole: 'teacher',
      status: 'approved',
      source: 'creator',
    },
    {
      classId: cls._id,
      userId: student._id,
      memberRole: 'student',
      status: 'approved',
      source: 'member_add',
    },
  ]);
  return { teacher, student, cls };
}
const mkTemplate = async (t: U, qs: unknown[] = questions(), title = 'De 1') => {
  const r = await send(tplList.POST, t, {
    method: 'POST',
    body: { title, description: 'd', questions: qs },
  });
  expect(r.status).toBe(201);
  return r.body.data.id as string;
};
const mkSitting = async (
  t: U,
  templateId: string,
  classId: string,
  over: Record<string, unknown> = {},
) => {
  const now = Date.now();
  const r = await send(sitList.POST, t, {
    method: 'POST',
    body: {
      templateId,
      openAt: new Date(now - 60_000).toISOString(),
      closeAt: new Date(now + 3_600_000).toISOString(),
      durationMinutes: 30,
      classIds: [classId],
      allInClasses: true,
      excludeStudentIds: [],
      ...over,
    },
  });
  return r;
};

describe('templates', () => {
  it('CRUD, unique live titles, trash/restore/purge, duplicate, ownership 404', async () => {
    const { teacher } = await world();
    const other = await mkUser('teacher');
    const id = await mkTemplate(teacher);
    expect(
      (
        await send(tplList.POST, teacher, {
          method: 'POST',
          body: { title: ' de 1 ', questions: questions() },
        })
      ).body.code,
    ).toBe('TEMPLATE_TITLE_TAKEN');
    expect(
      (await send(tplList.POST, teacher, { method: 'POST', body: { title: 'x', questions: [] } }))
        .status,
    ).toBe(400);
    const got = await send(tplOne.GET, teacher, { params: { id } });
    expect(got.body.data).toMatchObject({
      title: 'De 1',
      totalQuestions: 2,
      scoring: { mcqMax: 10, essayMax: 0 },
    });
    expect(got.body.data.questions[0].correctAnswer).toBe('B');
    expect((await send(tplOne.GET, other, { params: { id } })).status).toBe(404); // not the owner
    expect((await send(tplOne.GET, teacher, { params: { id: 'nope' } })).status).toBe(404);

    const put = await send(tplOne.PUT, teacher, {
      method: 'PUT',
      params: { id },
      body: { title: 'De 1b', questions: [...questions(), essayQ()] },
    });
    expect(put.status).toBe(200);
    expect(put.body.data.scoring).toEqual({ mcqMax: 7.5, essayMax: 2.5 });

    const dup = await send(tplDup.POST, teacher, { method: 'POST', params: { id } });
    expect(dup.status).toBe(201);
    expect(dup.body.data.title).toBe('De 1b (bản sao)');

    const del = await send(tplOne.DELETE, teacher, { method: 'DELETE', params: { id } });
    expect(del.status).toBe(200);
    expect((await send(tplOne.GET, teacher, { params: { id } })).status).toBe(404); // hidden once trashed
    expect(
      (await send(tplList.GET, teacher, { url: 'http://localhost/api/templates' })).body.data.total,
    ).toBe(1);
    const trash = await send(tplList.GET, teacher, {
      url: 'http://localhost/api/templates?view=deleted',
    });
    expect(trash.body.data.items[0]).toMatchObject({ title: 'De 1b' });
    expect(trash.body.data.items[0].daysLeft).toBeGreaterThan(28);

    // a live template takes the name while the other is in the trash: restore then conflicts, renaming works
    await send(tplList.POST, teacher, {
      method: 'POST',
      body: { title: 'De 1b', questions: questions() },
    });
    const clash = await send(tplRestore.POST, teacher, {
      method: 'POST',
      params: { id },
      body: {},
    });
    expect(clash.status).toBe(409);
    expect(clash.body.code).toBe('TEMPLATE_TITLE_TAKEN');
    expect(
      (
        await send(tplRestore.POST, teacher, {
          method: 'POST',
          params: { id },
          body: { title: 'Moi' },
        })
      ).status,
    ).toBe(200);

    expect(
      (await send(tplPurge.DELETE, teacher, { method: 'DELETE', params: { id } })).body.code,
    ).toBe('TEMPLATE_NOT_IN_TRASH'); // live
    await send(tplOne.DELETE, teacher, { method: 'DELETE', params: { id } });
    expect((await send(tplPurge.DELETE, other, { method: 'DELETE', params: { id } })).status).toBe(
      404,
    );
    expect(
      (await send(tplPurge.DELETE, teacher, { method: 'DELETE', params: { id } })).status,
    ).toBe(200);
    expect(
      await ExamTemplateModel.countDocuments({ _id: id }).setOptions({ withDeleted: true }),
    ).toBe(0);
  });

  it('students cannot use template routes', async () => {
    const student = await mkUser('student');
    expect(
      (await send(tplList.GET, student, { url: 'http://localhost/api/templates' })).status,
    ).toBe(403);
  });
});

describe('sittings (teacher side)', () => {
  it('creates a COPY of the questions, code, grants; validations; overlap; title uniqueness', async () => {
    const { teacher, student, cls } = await world();
    const tid = await mkTemplate(teacher);
    const r = await mkSitting(teacher, tid, String(cls._id));
    expect(r.status).toBe(201);
    expect(r.body.data.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    const sid = r.body.data.id as string;
    expect(await SittingGrantModel.countDocuments({ sittingId: sid, studentId: student._id })).toBe(
      1,
    );

    // later template edits do not change the sitting
    await send(tplOne.PUT, teacher, {
      method: 'PUT',
      params: { id: tid },
      body: { questions: [questions()[0]] },
    });
    const detail = await send(sitOne.GET, teacher, { params: { id: sid } });
    expect(detail.body.data.questions).toHaveLength(2);
    expect(detail.body.data).toMatchObject({
      locked: false,
      templateStatus: 'active',
      ungrantedInClassCount: 0,
    });

    // same open minute in the same class clashes; a different title is needed
    const tid2 = await mkTemplate(teacher, questions(), 'De 2');
    const openAt = new Date(detail.body.data.openAt);
    const clash = await mkSitting(teacher, tid2, String(cls._id), {
      openAt: openAt.toISOString(),
      title: 'Ca khac',
    });
    expect(clash.body.code).toBe('SITTING_OVERLAP');
    const dupTitle = await mkSitting(teacher, tid2, String(cls._id), {
      openAt: new Date(openAt.getTime() - 5 * 60_000).toISOString(),
      title: 'De 1',
    });
    expect(dupTitle.body.code).toBe('SITTING_TITLE_TAKEN');
    expect(
      (
        await mkSitting(teacher, tid2, String(cls._id), {
          closeAt: new Date(Date.now() - 1000).toISOString(),
        })
      ).status,
    ).toBe(400);
    expect((await mkSitting(teacher, tid2, String(cls._id), { durationMinutes: 0 })).status).toBe(
      400,
    );
    expect((await mkSitting(teacher, tid2, new Types.ObjectId().toString())).body.code).toBe(
      'INVALID_CLASSES',
    );

    const code2 = await send(sitCode.POST, teacher, { method: 'POST', params: { id: sid } });
    expect(code2.body.data.code).not.toBe(r.body.data.code);
    const other = await mkUser('teacher');
    expect((await send(sitOne.GET, other, { params: { id: sid } })).status).toBe(404);
  });

  it('grants: add / revoke (skips submitted), list; delete blocked by a submission', async () => {
    const { teacher, student, cls } = await world();
    const sid = (
      await mkSitting(teacher, await mkTemplate(teacher), String(cls._id), {
        allInClasses: false,
        studentIds: [],
      })
    ).body.data.id as string;
    expect((await send(sitGrants.GET, teacher, { params: { id: sid } })).body.data.total).toBe(0);
    const add = await send(sitGrants.POST, teacher, {
      method: 'POST',
      params: { id: sid },
      body: { studentIds: [String(student._id)] },
    });
    expect(add.body.data).toEqual({ granted: 1, alreadyGranted: 0 });
    expect(
      (
        await send(sitGrants.POST, teacher, {
          method: 'POST',
          params: { id: sid },
          body: { studentIds: [String(student._id)] },
        })
      ).body.data.alreadyGranted,
    ).toBe(1);
    expect(
      (
        await send(sitGrants.POST, teacher, {
          method: 'POST',
          params: { id: sid },
          body: { studentIds: [String(new Types.ObjectId())] },
        })
      ).body.code,
    ).toBe('INVALID_STUDENTS');
    const rev = await send(sitRevoke.POST, teacher, {
      method: 'POST',
      params: { id: sid },
      body: { studentIds: [String(student._id)] },
    });
    expect(rev.body.data.revoked).toBe(1);
    await SittingSubmissionModel.create({
      sittingId: sid,
      studentId: student._id,
      classIds: [cls._id],
      maxScore: 10,
    });
    expect(
      (await send(sitOne.DELETE, teacher, { method: 'DELETE', params: { id: sid } })).body.code,
    ).toBe('SITTING_HAS_SUBMISSIONS');
  });
});

describe('student exam flow', () => {
  const resolve = (u: U, code: string) =>
    send(meResolve.POST, u, { method: 'POST', body: { code } });
  const start = (u: U, id: string) =>
    send(meStart.POST, u, { method: 'POST', params: { sittingId: id } });
  const submit = (u: U, id: string, body: unknown) =>
    send(meSubmit.POST, u, { method: 'POST', params: { sittingId: id }, body });

  it('resolve, access rules, start hides answers and is idempotent, submit grades, no double submit', async () => {
    const { teacher, student, cls } = await world();
    const outsider = await mkUser('student');
    const created = await mkSitting(teacher, await mkTemplate(teacher), String(cls._id), {
      shuffleQuestions: true,
    });
    const { id, code } = created.body.data as { id: string; code: string };

    expect((await resolve(student, 'abc')).body.code).toBe('INVALID_CODE');
    expect((await resolve(student, 'ZZZZZZ')).body.code).toBe('SITTING_NOT_FOUND');
    expect((await resolve(outsider, code)).body.code).toBe('NOT_GRANTED');
    const info = await resolve(student, ` ${code.toLowerCase()} `);
    expect(info.status).toBe(200);
    expect(info.body.data).toMatchObject({ id, myState: 'open', totalQuestions: 2 });
    expect(JSON.stringify(info.body)).not.toContain('correctAnswer');
    expect((await start(outsider, id)).body.code).toBe('NOT_GRANTED');

    const s1 = await start(student, id);
    expect(s1.status).toBe(200);
    const raw = JSON.stringify(s1.body);
    for (const secret of ['correctAnswer', 'explanation', 'because', 'rubric'])
      expect(raw).not.toContain(secret);
    expect(s1.body.data.questions).toHaveLength(2);
    expect(s1.body.data.remainingSeconds).toBeGreaterThan(1700);
    const s2 = await start(student, id);
    expect(s2.body.data.deadlineAt).toBe(s1.body.data.deadlineAt); // the SAME session
    expect(await SittingSessionModel.countDocuments({ sittingId: id })).toBe(1);

    // answer by what is DISPLAYED: find the display letter whose original option is the correct one
    const order = s1.body.data.optionsOrder as Record<string, string[]>;
    const display = (qid: number, original: string) =>
      ['A', 'B', 'C', 'D'][order[String(qid)].indexOf(original)];
    const ok = await submit(student, id, {
      answers: { '1': display(1, 'B'), '2': display(2, 'A') },
    });
    expect(ok.status).toBe(201);
    expect(ok.body.data.submittedAt).toBeTruthy();
    expect(JSON.stringify(ok.body)).not.toMatch(/score|correct/i);
    const sub = await SittingSubmissionModel.findOne({ sittingId: id });
    expect(sub).toMatchObject({ score: 10, correctCount: 2, gradingStatus: 'none' });

    const again = await submit(student, id, { answers: {} });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('ALREADY_SUBMITTED');
    expect((await start(student, id)).body.code).toBe('ALREADY_SUBMITTED');
    expect(
      (
        await meList
          .GET(new Request('http://localhost/api/me/sittings', { headers: bearer(student) }), {
            params: Promise.resolve({}),
          } as never)
          .then((r) => r.json())
      ).data.items[0].myState,
    ).toBe('submitted');
  });

  it('parallel submits create exactly one submission', async () => {
    const { teacher, student, cls } = await world();
    const { id } = (await mkSitting(teacher, await mkTemplate(teacher), String(cls._id))).body.data;
    await start(student, id);
    const results = await Promise.all(
      Array.from({ length: 5 }, () => submit(student, id, { answers: { '1': 'B' } })),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(4);
    expect(await SittingSubmissionModel.countDocuments({ sittingId: id })).toBe(1);
  });

  it('time rules: not started, ended, time up, after the grace; teacher owner can try (byTeacher)', async () => {
    const { teacher, student, cls } = await world();
    const future = (
      await mkSitting(teacher, await mkTemplate(teacher), String(cls._id), {
        openAt: new Date(Date.now() + 3_600_000).toISOString(),
        closeAt: new Date(Date.now() + 7_200_000).toISOString(),
      })
    ).body.data.id;
    expect((await start(student, future)).body.code).toBe('SITTING_NOT_STARTED');
    const tid = await mkTemplate(teacher, questions(), 'De 2');
    const { id } = (
      await mkSitting(teacher, tid, String(cls._id), {
        openAt: new Date(Date.now() - 120_000).toISOString(),
      })
    ).body.data;
    await start(student, id);
    await SittingSessionModel.updateOne(
      { sittingId: id },
      { deadlineAt: new Date(Date.now() - 200_000) },
    );
    expect((await submit(student, id, { answers: {} })).body.code).toBe('TIME_UP'); // past deadline + 120s grace
    expect((await start(student, id)).body.code).toBe('TIME_UP');
    await SittingSessionModel.updateOne(
      { sittingId: id },
      { deadlineAt: new Date(Date.now() - 10_000) },
    );
    expect((await submit(student, id, { answers: { '1': 'B' } })).status).toBe(201); // inside the grace

    const tid3 = await mkTemplate(teacher, questions(), 'De 3');
    const own = (
      await mkSitting(teacher, tid3, String(cls._id), {
        openAt: new Date(Date.now() - 300_000).toISOString(),
      })
    ).body.data.id;
    expect((await start(teacher, own)).status).toBe(200);
    expect((await submit(teacher, own, { answers: { '1': 'B' } })).status).toBe(201);
    expect((await SittingSubmissionModel.findOne({ sittingId: own }))?.byTeacher).toBe(true);
  });

  it('removing the student from the class closes the door', async () => {
    const { teacher, student, cls } = await world();
    const { id } = (await mkSitting(teacher, await mkTemplate(teacher), String(cls._id))).body.data;
    await ClassMemberModel.deleteOne({ classId: cls._id, userId: student._id });
    expect((await start(student, id)).body.code).toBe('NOT_GRANTED');
  });
});

describe('essay: upload, grading, publication, result', () => {
  it('end to end', async () => {
    const { teacher, student, cls } = await world();
    const tid = await mkTemplate(teacher, [...questions(), essayQ()]);
    const { id } = (await mkSitting(teacher, tid, String(cls._id))).body.data as { id: string };
    const st = await send(meStart.POST, student, { method: 'POST', params: { sittingId: id } });
    const token = st.body.data.uploadToken as string;
    expect(token).toMatch(/^[0-9a-f]{48}$/);

    const up = (u: U, tk: string, file: File, q = 3) => {
      const form = new FormData();
      form.append('file', file);
      return upload.POST(
        new Request(`http://localhost/api/essay-uploads?questionId=${q}`, {
          method: 'POST',
          body: form,
          headers: { ...bearer(u), 'x-upload-token': tk },
        }),
      );
    };
    const r1 = await up(
      student,
      token,
      new File(['My essay text'], 'essay.txt', { type: 'text/plain' }),
    );
    expect(r1.status).toBe(201);
    const uploadId = (await r1.json()).data.uploadId as string;
    expect(
      (
        await up(
          student,
          token,
          new File([new Uint8Array([1, 2, 3, 4])], 'x.png', { type: 'image/png' }),
        )
      ).status,
    ).toBe(415); // renamed binary
    expect((await up(student, 'a'.repeat(48), new File(['x'], 'a.txt'))).status).toBe(403);
    expect((await up(await mkUser('student'), token, new File(['x'], 'a.txt'))).status).toBe(403); // another student
    expect((await up(student, token, new File(['x'], 'a.txt'), 1)).status).toBe(400); // not an essay question

    const sub = await send(meSubmit.POST, student, {
      method: 'POST',
      params: { sittingId: id },
      body: { answers: { '1': 'B', '2': 'A' }, essayAnswers: { '3': { uploadId } } },
    });
    expect(sub.status).toBe(201);
    const stored = await SittingSubmissionModel.findOne({ sittingId: id });
    expect(stored?.essayAnswers[0]).toMatchObject({
      questionId: 3,
      text: 'My essay text',
      source: 'file-text',
    });
    expect(stored).toMatchObject({ gradingStatus: 'pending', mcqScore: 7.5, score: 7.5 });
    const subId = String(stored?._id);

    // not graded: publication is refused and the student cannot see a result
    expect(
      (await send(sitPublish.POST, teacher, { method: 'POST', params: { id } })).body.code,
    ).toBe('GRADING_INCOMPLETE');
    expect((await send(meResult.GET, student, { params: { sittingId: id } })).body.code).toBe(
      'RESULTS_NOT_PUBLISHED',
    );

    // grading validation + optimistic lock
    const grade = (body: unknown) =>
      send(sitGrade.PUT, teacher, {
        method: 'PUT',
        params: { id, submissionId: subId, questionId: '3' },
        body,
      });
    expect((await grade({ criteria: [{ key: 'k1', score: 0.3 }] })).status).toBe(400); // not a multiple of 0.25
    expect((await grade({ criteria: [{ key: 'k1', score: 2 }] })).status).toBe(400); // over the criterion max
    expect((await grade({ criteria: [{ key: 'nope', score: 1 }] })).status).toBe(400);
    const g1 = await grade({
      criteria: [
        { key: 'k1', score: 1, comment: '<b>ok</b>' },
        { key: 'k2', score: 1.5 },
      ],
      feedback: 'good',
      baseGradedAt: null,
    });
    expect(g1.status).toBe(200);
    expect(g1.body.data).toMatchObject({
      essayScore: 2.5,
      score: 10,
      essayGraded: true,
      gradingStatus: 'done',
    });
    expect(
      (await SittingSubmissionModel.findOne({ sittingId: id }))?.essayResults[0].criteria[0]
        .comment,
    ).toBe('bok/b'); // < > removed
    const stale = await grade({ criteria: [{ key: 'k1', score: 0.5 }], baseGradedAt: null }); // someone graded meanwhile
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('GRADE_CONFLICT');
    const other = await mkUser('teacher');
    expect(
      (
        await send(sitGrade.PUT, other, {
          method: 'PUT',
          params: { id, submissionId: subId, questionId: '3' },
          body: { criteria: [{ key: 'k1', score: 1 }] },
        })
      ).status,
    ).toBe(404);

    // results list for the teacher
    const results = await send(sitResults.GET, teacher, {
      params: { id },
      url: `http://localhost/api/sittings/${id}/results`,
    });
    expect(results.body.data.stats).toMatchObject({
      totalSubmissions: 1,
      gradedSubmissions: 1,
      avgScore: 10,
    });
    expect(results.body.data.submissions[0]).toMatchObject({ essayGraded: true, totalScore: 10 });

    // the same query the web panel sends
    const ui = await send(sitResults.GET, teacher, {
      params: { id },
      url: `http://localhost/api/sittings/${id}/results?page=1&limit=50&sort=name`,
    });
    expect(ui.status).toBe(200);
    expect(ui.body.data.submissions).toHaveLength(1);

    // publish, the student sees only scores; unpublish hides again
    const pub = await send(sitPublish.POST, teacher, { method: 'POST', params: { id } });
    expect(pub.status).toBe(200);
    expect(
      (await send(sitPublish.POST, teacher, { method: 'POST', params: { id } })).body.data
        .alreadyPublished,
    ).toBe(true);
    const res = await send(meResult.GET, student, { params: { sittingId: id } });
    expect(res.status).toBe(200);
    expect(res.body.data.summary).toMatchObject({
      score: 10,
      maxScore: 10,
      mcqScore: 7.5,
      essayScore: 2.5,
    });
    expect(JSON.stringify(res.body)).not.toMatch(/correctAnswer|explanation|rubric/);
    expect(res.headers.get('cache-control')).toMatch(/no-store/);
    const info = await send(meResolve.POST, student, {
      method: 'POST',
      body: { code: (await ExamSittingModel.findById(id))!.code },
    });
    expect(info.body.data.result).toEqual({ score: 10, maxScore: 10 });
    await send(sitUnpublish.POST, teacher, { method: 'POST', params: { id } });
    expect((await send(meResult.GET, student, { params: { sittingId: id } })).body.code).toBe(
      'RESULTS_NOT_PUBLISHED',
    );
  });

  it('editing questions of an open sitting is locked while attempts exist; closed sitting regrades', async () => {
    const { teacher, student, cls } = await world();
    const { id } = (await mkSitting(teacher, await mkTemplate(teacher), String(cls._id))).body
      .data as { id: string };
    await send(meStart.POST, student, { method: 'POST', params: { sittingId: id } });
    const edit = (qs: unknown[]) =>
      send(sitOne.PUT, teacher, { method: 'PUT', params: { id }, body: { questions: qs } });
    expect((await edit(questions())).body.code).toBe('SITTING_LOCKED'); // an active session
    // settings are still editable
    expect(
      (
        await send(sitOne.PUT, teacher, {
          method: 'PUT',
          params: { id },
          body: { description: 'x' },
        })
      ).status,
    ).toBe(200);
    await SittingSessionModel.deleteMany({ sittingId: id });
    await SittingSubmissionModel.create({
      sittingId: id,
      studentId: student._id,
      classIds: [cls._id],
      answers: new Map([
        ['1', 'B'],
        ['2', 'A'],
      ]),
      score: 10,
      mcqScore: 10,
      maxScore: 10,
      correctCount: 2,
      totalQuestions: 2,
      byTeacher: true,
    });
    // a teacher trial submission does not lock; changing the answer key regrades it
    const changed = questions();
    changed[0].correctAnswer = 'C';
    const r = await edit(changed);
    expect(r.status).toBe(200);
    expect(r.body.data.updatedSubmissionsCount).toBe(1);
    expect(await SittingSubmissionModel.findOne({ sittingId: id })).toMatchObject({
      correctCount: 1,
      score: 5,
    });
  });
});
