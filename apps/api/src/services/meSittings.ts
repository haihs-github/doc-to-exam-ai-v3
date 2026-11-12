// Created by Haihs on 12/11/2026
// Student-side sitting use cases: my sittings, resolve a code, start (server-held clock), session sync, submit (server-side mcq grading). Never returns scores or answers before publication. Port of server/controllers/meSittingController.js.
import { randomBytes } from 'node:crypto';
import type { Types } from 'mongoose';
import { ok, pageResult, parsePage, toObjectId } from '../lib/apiResponse';
import type { AuthCtx } from '../lib/auth';
import {
  computeScoring,
  gradeSubmission,
  hasEssayQuestions,
  isEssayQuestion,
  sanitizeAnswers,
  sanitizeEssayAnswers,
  type Question,
} from '../lib/examValidation';
import { generateShuffledOptionsOrder, generateShuffledQuestionOrder } from '../lib/examShuffle';
import { HttpError, readJson } from '../lib/handler';
import { ClassModel } from '../models/Class';
import { ClassMemberModel } from '../models/ClassMember';
import { ExamSittingModel } from '../models/ExamSitting';
import { SittingGrantModel } from '../models/SittingGrant';
import { SittingSessionModel } from '../models/SittingSession';
import { SittingSubmissionModel } from '../models/SittingSubmission';
import {
  findSittingCached,
  getSittingAvailability,
  normalizeSittingCode,
  type CachedSitting,
} from './sittingLookup';

const SUBMIT_GRACE_MS = 120 * 1000; // grace to submit after deadlineAt
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000; // session expiresAt = deadlineAt + 30 days
const MAX_CODE_INPUT_LENGTH = 32; // cut long strings before normalising / looking up
const MAX_VIOLATIONS = 200;
const MAX_VIOLATION_REASON = 200;
const SITTING_CODE_PATTERN = /^[A-Z0-9]{6}$/;
const SUBMIT_JSON_MAX = 2 * 1024 * 1024;
const ALREADY_SUBMITTED_MESSAGE = 'Bài làm của bạn đã được ghi nhận trước đó. Không thể nộp lại!';

const sittingNotFound = () => new HttpError('SITTING_NOT_FOUND', 'Không tìm thấy ca thi.');
const notGranted = () =>
  new HttpError(
    'NOT_GRANTED',
    'Bạn chưa được cấp quyền vào ca thi này, hãy liên hệ giáo viên để biết thêm chi tiết.',
  );
const noSession = () =>
  new HttpError(
    'NO_SESSION',
    'Không tìm thấy phiên làm bài của bạn. Hãy vào lại ca thi để bắt đầu.',
  );
const paramsOf = async (ctx: AuthCtx) => ((await ctx.params) ?? {}) as Record<string, string>;

/** Sitting by the URL id (through the cache); malformed or missing -> null. */
async function loadSitting(ctx: AuthCtx): Promise<CachedSitting | null> {
  const id = toObjectId((await paramsOf(ctx)).sittingId);
  return id ? findSittingCached(String(id)) : null;
}

/**
 * Shared access check (NOT cached): (a) a SittingGrant exists AND (b) the student is still an approved member of at least one
 * live class of the sitting. The owner may try their own sitting (byCreator).
 */
async function checkAccess(sitting: CachedSitting, studentId: Types.ObjectId) {
  if (String(sitting.createdBy) === String(studentId))
    return {
      granted: true,
      hasGrant: true,
      grant: { classIds: [] as Types.ObjectId[] },
      memberClassIds: [] as Types.ObjectId[],
      byCreator: true,
    };
  const [grant, liveClasses, members] = await Promise.all([
    SittingGrantModel.findOne({ sittingId: sitting._id, studentId }).select('classIds').lean(),
    ClassModel.find({ _id: { $in: sitting.classIds } })
      .select('_id')
      .lean(), // the plugin hides deleted classes
    ClassMemberModel.find({
      userId: studentId,
      memberRole: 'student',
      status: 'approved',
      classId: { $in: sitting.classIds },
    })
      .select('classId')
      .lean(),
  ]);
  const live = new Set(liveClasses.map((c) => String(c._id)));
  const memberClassIds = members.map((m) => m.classId).filter((id) => live.has(String(id)));
  return {
    granted: Boolean(grant) && memberClassIds.length > 0,
    hasGrant: Boolean(grant),
    grant,
    memberClassIds,
    byCreator: false,
  };
}

type MyState = 'not_started' | 'open' | 'in_progress' | 'submitted' | 'missed';
/** submitted > unexpired session (in_progress) > expired session / closed (missed) > by time. */
function computeMyState(a: {
  availability: { status: 'not_started' | 'open' | 'ended' };
  submission: unknown;
  session: { deadlineAt: Date } | null | undefined;
  now: Date;
}): MyState {
  if (a.submission) return 'submitted';
  if (a.session)
    return a.now.getTime() <= a.session.deadlineAt.getTime() + SUBMIT_GRACE_MS
      ? 'in_progress'
      : 'missed';
  if (a.availability.status === 'not_started') return 'not_started';
  return a.availability.status === 'open' ? 'open' : 'missed';
}

type InfoSource = Pick<
  CachedSitting,
  | '_id'
  | 'code'
  | 'title'
  | 'description'
  | 'openAt'
  | 'closeAt'
  | 'durationMinutes'
  | 'totalQuestions'
  | 'shuffleQuestions'
  | 'antiCheat'
>;
/** Sitting info for a student: NO questions, NO scores. */
const toSittingInfo = (
  s: InfoSource,
  availability: { status: 'not_started' | 'open' | 'ended' },
  myState: MyState,
  submission: { submittedAt: Date } | null | undefined,
) => ({
  id: String(s._id),
  code: s.code,
  title: s.title,
  description: s.description,
  openAt: s.openAt.toISOString(),
  closeAt: s.closeAt.toISOString(),
  durationMinutes: s.durationMinutes,
  totalQuestions: s.totalQuestions,
  shuffleQuestions: Boolean(s.shuffleQuestions),
  antiCheat: Boolean(s.antiCheat),
  status: availability.status,
  myState,
  ...(submission ? { submittedAt: submission.submittedAt.toISOString() } : {}),
});

/** Whitelisted fields only: never correctAnswer, explanation or rubric; just maxScore (shown as "(x điểm)"). */
function toStudentQuestion(q: Question, mcqMaxScore: number) {
  if (isEssayQuestion(q))
    return {
      id: q.id,
      type: 'essay' as const,
      context: q.context ?? '',
      questionText: q.questionText,
      requirements: q.requirements ?? '',
      maxScore: q.maxScore,
    };
  return {
    id: q.id,
    maxScore: mcqMaxScore,
    context: q.context ?? '',
    questionText: q.questionText,
    options: {
      A: q.options?.A ?? '',
      B: q.options?.B ?? '',
      C: q.options?.C ?? '',
      D: q.options?.D ?? '',
    },
  };
}
const mcqMaxScoreEach = (questions: Question[]): number => {
  const mcq = questions.filter((q) => !isEssayQuestion(q)).length;
  return mcq > 0 ? Math.round((computeScoring(questions).mcqMax / mcq) * 100) / 100 : 0;
};

const plainMap = (value: unknown): Record<string, string[]> =>
  value instanceof Map ? Object.fromEntries(value) : ((value ?? {}) as Record<string, string[]>);
const remainingSeconds = (session: { deadlineAt: Date }, now: Date): number =>
  Math.max(0, Math.floor((session.deadlineAt.getTime() - now.getTime()) / 1000));

/** 409 ALREADY_SUBMITTED (with submittedAt, no score) when the student already has a submission. */
async function throwIfAlreadySubmitted(
  sittingId: Types.ObjectId,
  studentId: Types.ObjectId,
): Promise<void> {
  const submission = await SittingSubmissionModel.findOne({ sittingId, studentId })
    .select('submittedAt')
    .lean();
  if (submission)
    throw new HttpError('ALREADY_SUBMITTED', ALREADY_SUBMITTED_MESSAGE, {
      data: { submittedAt: submission.submittedAt.toISOString() },
    });
}

// The session is deleted asynchronously after the response, so a re-submit still gets 409 (not NO_SESSION).
const pendingCleanups = new Set<Promise<unknown>>();
function cleanupSessionAfterResponse(filter: {
  sittingId: Types.ObjectId;
  studentId: Types.ObjectId;
}): void {
  const task: Promise<unknown> = SittingSessionModel.deleteOne(filter)
    .catch(() => {})
    .finally(() => pendingCleanups.delete(task));
  pendingCleanups.add(task);
}
/** Tests / shutdown only: waits for session cleanups in flight. */
export const settlePendingSessionCleanups = () => Promise.allSettled([...pendingCleanups]);

const canViewInfo = async (
  access: { hasGrant: boolean },
  sitting: CachedSitting,
  studentId: Types.ObjectId,
) =>
  access.hasGrant ||
  Boolean(await SittingSubmissionModel.exists({ sittingId: sitting._id, studentId }));

// TODO(api): M7 — kèm result {score,maxScore} khi kết quả đã công bố (isResultVisible/toResultBadge)
async function describeForStudent(sitting: CachedSitting, studentId: Types.ObjectId, now: Date) {
  const [submission, session] = await Promise.all([
    SittingSubmissionModel.findOne({ sittingId: sitting._id, studentId })
      .select('submittedAt')
      .lean(),
    SittingSessionModel.findOne({ sittingId: sitting._id, studentId }).select('deadlineAt').lean(),
  ]);
  const availability = getSittingAvailability(sitting, now);
  return toSittingInfo(
    sitting,
    availability,
    computeMyState({ availability, submission, session, now }),
    submission,
  );
}

export async function listMine(req: Request, ctx: AuthCtx): Promise<Response> {
  const studentId = ctx.user._id;
  const now = new Date();
  const grants = await SittingGrantModel.find({ studentId }).select('sittingId').lean();
  const ids = grants.map((g) => g.sittingId);
  const [sittings, submissions, sessions, memberships] = await Promise.all([
    ExamSittingModel.find({ _id: { $in: ids } })
      .select(
        'code title description openAt closeAt durationMinutes totalQuestions shuffleQuestions antiCheat classIds resultsPublishedAt',
      )
      .lean(),
    SittingSubmissionModel.find({ studentId, sittingId: { $in: ids } })
      .select('sittingId submittedAt')
      .lean(),
    SittingSessionModel.find({ studentId, sittingId: { $in: ids } })
      .select('sittingId deadlineAt')
      .lean(),
    ClassMemberModel.find({ userId: studentId, memberRole: 'student', status: 'approved' })
      .select('classId')
      .lean(),
  ]);
  const liveClasses = await ClassModel.find({ _id: { $in: memberships.map((m) => m.classId) } })
    .select('_id')
    .lean();
  const memberOf = new Set(liveClasses.map((c) => String(c._id)));
  const submissionBy = new Map(submissions.map((s) => [String(s.sittingId), s]));
  const sessionBy = new Map(sessions.map((s) => [String(s.sittingId), s]));

  const rows: ReturnType<typeof toRow>[] = [];
  function toRow(sitting: (typeof sittings)[number]) {
    const submission = submissionBy.get(String(sitting._id));
    const availability = getSittingAvailability(sitting, now);
    const myState = computeMyState({
      availability,
      submission,
      session: sessionBy.get(String(sitting._id)),
      now,
    });
    const { id, code, title, openAt, closeAt, durationMinutes, status, submittedAt } =
      toSittingInfo(sitting as unknown as InfoSource, availability, myState, submission);
    return {
      id,
      code,
      title,
      openAt,
      closeAt,
      durationMinutes,
      status,
      myState,
      ...(submittedAt ? { submittedAt } : {}),
    };
  }
  for (const sitting of sittings) {
    // a sitting whose classes the student left still shows once submitted
    if (
      !submissionBy.has(String(sitting._id)) &&
      !sitting.classIds.some((id) => memberOf.has(String(id)))
    )
      continue;
    rows.push(toRow(sitting));
  }
  rows.sort((a, b) => new Date(b.openAt).getTime() - new Date(a.openAt).getTime());
  const paging = parsePage(new URL(req.url).searchParams, { defaultLimit: 20, maxLimit: 100 });
  // TODO(api): M7 — gắn result cho các ca đã công bố trong trang hiện tại
  return ok(pageResult(rows.slice(paging.skip, paging.skip + paging.limit), rows.length, paging));
}

/** POST /api/me/sittings/resolve {code}: code -> sitting info without questions. */
export async function resolve(req: Request, ctx: AuthCtx): Promise<Response> {
  const body = (await readJson(req, 1024).catch(() => null)) as { code?: unknown } | null;
  const raw = body && typeof body === 'object' ? body.code : undefined;
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_CODE_INPUT_LENGTH)
    throw new HttpError('INVALID_CODE', 'Mã ca thi không hợp lệ.');
  const code = normalizeSittingCode(raw);
  if (!SITTING_CODE_PATTERN.test(code))
    throw new HttpError('INVALID_CODE', 'Mã ca thi không hợp lệ.');
  const sitting = await findSittingCached(code);
  if (!sitting) throw sittingNotFound();
  const access = await checkAccess(sitting, ctx.user._id);
  if (!(await canViewInfo(access, sitting, ctx.user._id))) throw notGranted();
  const info = await describeForStudent(sitting, ctx.user._id, new Date());
  if (!access.granted && info.myState !== 'submitted') throw notGranted();
  return ok({ ...info, serverTime: new Date().toISOString() });
}

export async function getOne(_req: Request, ctx: AuthCtx): Promise<Response> {
  const sitting = await loadSitting(ctx);
  if (!sitting) throw sittingNotFound();
  const access = await checkAccess(sitting, ctx.user._id);
  if (!(await canViewInfo(access, sitting, ctx.user._id))) throw notGranted();
  const info = await describeForStudent(sitting, ctx.user._id, new Date());
  if (!access.granted && info.myState !== 'submitted') throw notGranted();
  return ok({ ...info, serverTime: new Date().toISOString() });
}

/** POST /api/me/sittings/:sittingId/start: open / resume the session (idempotent), questions with answers stripped. */
export async function start(_req: Request, ctx: AuthCtx): Promise<Response> {
  const studentId = ctx.user._id;
  const sitting = await loadSitting(ctx);
  if (!sitting) throw sittingNotFound();
  const access = await checkAccess(sitting, studentId);
  if (!access.granted) throw notGranted();
  await throwIfAlreadySubmitted(sitting._id, studentId);

  const now = new Date();
  const filter = { sittingId: sitting._id, studentId };
  let session = await SittingSessionModel.findOne(filter).lean();
  if (session && now.getTime() > session.deadlineAt.getTime())
    throw new HttpError('TIME_UP', 'Đã quá thời gian làm bài của bạn.');
  if (!session) {
    const availability = getSittingAvailability(sitting, now);
    if (!availability.open)
      throw new HttpError(
        availability.status === 'not_started' ? 'SITTING_NOT_STARTED' : 'SITTING_ENDED',
        availability.message,
        {
          data: { openAt: sitting.openAt.toISOString(), closeAt: sitting.closeAt.toISOString() },
        },
      );
    const byDuration = new Date(now.getTime() + sitting.durationMinutes * 60 * 1000);
    const deadlineAt = byDuration < sitting.closeAt ? byDuration : sitting.closeAt;
    const questions = sitting.questions as unknown as Question[];
    const insertOnly = {
      startedAt: now,
      deadlineAt,
      questionOrder: sitting.shuffleQuestions
        ? generateShuffledQuestionOrder(questions)
        : questions.map((q) => q.id),
      optionsOrder: sitting.shuffleQuestions ? generateShuffledOptionsOrder(questions) : {},
      expiresAt: new Date(deadlineAt.getTime() + THIRTY_DAYS_MS),
      ...(hasEssayQuestions(questions) ? { uploadToken: randomBytes(24).toString('hex') } : {}),
    };
    try {
      // upsert with $setOnInsert: two parallel starts create ONE session
      session = await SittingSessionModel.findOneAndUpdate(
        filter,
        { $setOnInsert: insertOnly },
        { upsert: true, new: true, lean: true },
      );
    } catch (err) {
      if ((err as { code?: unknown }).code !== 11000) throw err;
      session = await SittingSessionModel.findOne(filter).lean();
    }
  }
  if (!session) throw noSession();
  const questions = sitting.questions as unknown as Question[];
  const mcqEach = mcqMaxScoreEach(questions);
  return ok({
    sittingId: String(sitting._id),
    title: sitting.title,
    description: sitting.description,
    durationMinutes: sitting.durationMinutes,
    openAt: sitting.openAt.toISOString(),
    closeAt: sitting.closeAt.toISOString(),
    totalQuestions: sitting.totalQuestions,
    shuffleQuestions: Boolean(sitting.shuffleQuestions),
    antiCheat: Boolean(sitting.antiCheat),
    startedAt: session.startedAt.toISOString(),
    deadlineAt: session.deadlineAt.toISOString(),
    remainingSeconds: remainingSeconds(session, now),
    serverTime: now.toISOString(),
    questionOrder: session.questionOrder ?? [],
    optionsOrder: plainMap(session.optionsOrder),
    ...(session.uploadToken ? { uploadToken: session.uploadToken } : {}),
    questions: questions.map((q) => toStudentQuestion(q, mcqEach)),
  });
}

/** GET /api/me/sittings/:sittingId/session: clock sync (the teacher may have changed the times). */
export async function getSession(_req: Request, ctx: AuthCtx): Promise<Response> {
  const sittingId = toObjectId((await paramsOf(ctx)).sittingId);
  if (!sittingId) throw sittingNotFound();
  const now = new Date();
  const session = await SittingSessionModel.findOne({ sittingId, studentId: ctx.user._id })
    .select('deadlineAt')
    .lean();
  if (!session) {
    await throwIfAlreadySubmitted(sittingId, ctx.user._id);
    throw noSession();
  }
  return ok({
    deadlineAt: session.deadlineAt.toISOString(),
    remainingSeconds: remainingSeconds(session, now),
    serverTime: now.toISOString(),
  });
}

/** Client violation log: cut at 200 entries, keep only {valid at, reason}. */
const sanitizeViolations = (raw: unknown) =>
  (Array.isArray(raw) ? raw.slice(0, MAX_VIOLATIONS) : [])
    .map((v: { at?: unknown; reason?: unknown } | null) => ({
      at: new Date(v?.at as string),
      reason: String(v?.reason ?? '').slice(0, MAX_VIOLATION_REASON),
    }))
    .filter((v) => !Number.isNaN(v.at.getTime()) && v.reason);

/** POST /api/me/sittings/:sittingId/submit: grade mcq on the server and store; the response is only {submittedAt, warnings?}. */
export async function submit(req: Request, ctx: AuthCtx): Promise<Response> {
  const studentId = ctx.user._id;
  const raw = await readJson(req, SUBMIT_JSON_MAX);
  const body = (raw && typeof raw === 'object' ? raw : {}) as {
    answers?: unknown;
    essayAnswers?: unknown;
    isAutoSubmit?: unknown;
    tabViolations?: unknown;
  };
  const sitting = await loadSitting(ctx);
  if (!sitting) throw sittingNotFound();
  const access = await checkAccess(sitting, studentId);
  if (!access.granted) throw notGranted();

  const now = new Date();
  const filter = { sittingId: sitting._id, studentId };
  const session = await SittingSessionModel.findOne(filter).lean();
  if (!session) {
    await throwIfAlreadySubmitted(sitting._id, studentId); // session deleted after submit: a re-submit is still 409
    throw noSession();
  }
  if (now.getTime() > session.deadlineAt.getTime() + SUBMIT_GRACE_MS) {
    await throwIfAlreadySubmitted(sitting._id, studentId);
    throw new HttpError(
      'TIME_UP',
      'Đã quá thời gian làm bài của bạn. Bài nộp không được ghi nhận.',
    );
  }

  const questions = sitting.questions as unknown as Question[];
  const optionsOrder = plainMap(session.optionsOrder);
  const questionOrder =
    Array.isArray(session.questionOrder) && session.questionOrder.length > 0
      ? session.questionOrder
      : questions.map((q) => q.id);
  const answers = sanitizeAnswers(body.answers, questions);
  const { correctCount, totalQuestions, score } = gradeSubmission(questions, answers, optionsOrder);

  const hasEssay = hasEssayQuestions(questions);
  // TODO(api): M6 — file/ảnh tự luận qua uploadId (resolveEssayAnswers); M5 chỉ nhận bài gõ trực tiếp
  const essayAnswers = hasEssay ? sanitizeEssayAnswers(textOnly(body.essayAnswers), questions) : [];

  const currentClasses = new Set(sitting.classIds.map(String));
  const snapshot = (access.grant?.classIds ?? []).filter((id) => currentClasses.has(String(id)));
  const submission = new SittingSubmissionModel({
    sittingId: sitting._id,
    studentId,
    classIds: snapshot.length > 0 ? snapshot : access.memberClassIds,
    byTeacher: access.byCreator,
    answers,
    score,
    mcqScore: score,
    essayScore: 0,
    maxScore: computeScoring(questions).total,
    essayAnswers,
    gradingStatus: hasEssay ? 'pending' : 'none',
    correctCount,
    totalQuestions,
    startedAt: session.startedAt,
    timeSpentSeconds: Math.max(0, Math.floor((now.getTime() - session.startedAt.getTime()) / 1000)),
    questionOrder,
    optionsOrder,
    isAutoSubmitted: Boolean(body.isAutoSubmit),
    submittedAt: now,
    tabViolations: sanitizeViolations(body.tabViolations),
  });
  try {
    await submission.save();
  } catch (err) {
    if ((err as { code?: unknown }).code === 11000) {
      // unique {sittingId, studentId}: a duplicate or 5 parallel requests
      await throwIfAlreadySubmitted(sitting._id, studentId);
      throw new HttpError('ALREADY_SUBMITTED', ALREADY_SUBMITTED_MESSAGE);
    }
    throw err;
  }
  const res = ok(
    { submittedAt: submission.submittedAt.toISOString() },
    { status: 201, message: 'Nộp bài thành công!' },
  );
  cleanupSessionAfterResponse(filter);
  return res;
}

/** { id: string | {text} } -> { id: text } (M5: typed answers only). */
function textOnly(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (raw && typeof raw === 'object')
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === 'string') out[k] = v;
      else if (v && typeof v === 'object' && typeof (v as { text?: unknown }).text === 'string')
        out[k] = (v as { text: string }).text;
    }
  return out;
}
