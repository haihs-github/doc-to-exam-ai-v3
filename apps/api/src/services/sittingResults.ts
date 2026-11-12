// Created by Haihs on 12/11/2026
// Teacher-side results, export, grading progress, manual essay grading, essay media, violation log and publication. Port of sittingResultsController.js and sittingPublicationController.js.
import type { Types } from 'mongoose';
import { ok, pageResult, parsePage, toObjectId } from '../lib/apiResponse';
import type { AuthCtx } from '../lib/auth';
import { sendEssayMedia } from '../lib/essayMedia';
import { loadEssayUploadConfig } from '../lib/essayUploadConfig';
import { SCORE_STEP, isQuarterStep } from '../lib/essayScore';
import { computeScoring, isEssayQuestion, type Question } from '../lib/examValidation';
import { HttpError, readJson } from '../lib/handler';
import {
  RESULTS_XLSX_MAX_ROWS,
  XLSX_MIME,
  buildResultsSheet,
  contentDisposition,
  renderXlsx,
} from '../lib/resultsXlsx';
import { escapeRegExp, toSearchKey } from '../lib/textUtils';
import { ClassModel } from '../models/Class';
import { ClassMemberModel } from '../models/ClassMember';
import { EssayMediaModel } from '../models/EssayMedia';
import { ExamSittingModel } from '../models/ExamSitting';
import { SittingGrantModel } from '../models/SittingGrant';
import { SittingSessionModel } from '../models/SittingSession';
import { SittingSubmissionModel, type IEssayResult } from '../models/SittingSubmission';
import { UserModel } from '../models/User';
import { computeEssayDisplay, summarizeStats } from './essayDisplay';
import { scheduleMediaRetention } from './essayUploads';
import { recomputeScores, refreshSubmissionStatus, upsertEssayResult } from './manualGrading';
import { clearEssayStaleIfRegraded } from './regrade';
import {
  approvedStudentFilter,
  classNameMap,
  liveClassIds,
  loadOwnedSitting,
  pageUsers,
} from './sittings';
import { countSubmissions, getPublicationInfo, publishAtomic } from './sittingPublication';
import { getSittingAvailability } from './sittingLookup';

const PAGE_SIZE = 50;
const MAX_FEEDBACK_CHARS = 1500;
const MAX_COMMENT_CHARS = 400;
const POSITIVE_INTEGER_PATTERN = /^[1-9]\d{0,9}$/;
const roundTo2 = (v: number): number => Math.round(v * 100) / 100;
type Obj = Record<string, unknown>;
type Sitting = NonNullable<Awaited<ReturnType<typeof loadOwnedSitting>>>;

const notFound = () => new HttpError('NOT_FOUND', 'Không tìm thấy ca thi.');
const submissionNotFound = () => new HttpError('NOT_FOUND', 'Không tìm thấy bài nộp.');
const bad = (message: string) => new HttpError('VALIDATION', message);
const paramsOf = async (ctx: AuthCtx) => ((await ctx.params) ?? {}) as Record<string, string>;
const owned = async (ctx: AuthCtx): Promise<Sitting> => {
  const s = await loadOwnedSitting(ctx);
  if (!s) throw notFound();
  return s;
};

/** Submission by id AND of this sitting (another sitting's / person's -> 404, the same answer). */
async function loadSubmissionOfSitting(ctx: AuthCtx, sitting: Sitting, select = '') {
  const id = toObjectId((await paramsOf(ctx)).submissionId);
  return id
    ? SittingSubmissionModel.findOne({ _id: id, sittingId: sitting._id }).select(select)
    : null;
}

/** classId empty/'all' = no filter; malformed = false. */
const parseClassFilter = (raw: string | null): Types.ObjectId | null | false =>
  raw === null || raw === '' || raw === 'all' ? null : (toObjectId(raw) ?? false);

const examInfo = (s: Sitting, now = new Date()) => ({
  id: String(s._id),
  title: s.title,
  code: s.code,
  status: getSittingAvailability(s, now).status,
  openAt: s.openAt.toISOString(),
  closeAt: s.closeAt.toISOString(),
  totalQuestions: s.totalQuestions,
  durationMinutes: s.durationMinutes,
  questions: s.questions,
});

/** One page of "not submitted": grants without a submission, CURRENT names, hasSession, inClass. */
async function describeNotSubmitted(
  sitting: Sitting,
  users: { _id: Types.ObjectId; fullName: string }[],
  { withPhone = false } = {},
) {
  const ids = users.map((u) => u._id);
  const live = await liveClassIds(sitting.classIds);
  const [sessions, inClass, phones] = await Promise.all([
    SittingSessionModel.distinct('studentId', { sittingId: sitting._id, studentId: { $in: ids } }),
    ClassMemberModel.distinct('userId', approvedStudentFilter(live, { userId: { $in: ids } })),
    withPhone
      ? UserModel.find({ _id: { $in: ids } })
          .select('phoneNumber')
          .lean()
      : Promise.resolve([]),
  ]);
  const phoneOf = new Map(phones.map((u) => [String(u._id), u.phoneNumber]));
  const sessionSet = new Set(sessions.map(String));
  const inClassSet = new Set(inClass.map(String));
  return users.map((u) => ({
    studentId: String(u._id),
    studentName: u.fullName,
    ...(withPhone ? { phoneNumber: phoneOf.get(String(u._id)) ?? '' } : {}),
    hasSession: sessionSet.has(String(u._id)),
    inClass: inClassSet.has(String(u._id)),
  }));
}

/** Students with a grant but no submission (a submission does NOT depend on the grant: whoever submitted is never in this list). */
async function notSubmittedIds(sitting: Sitting, classId: Types.ObjectId | null) {
  const submitted = await SittingSubmissionModel.distinct('studentId', { sittingId: sitting._id });
  return SittingGrantModel.distinct('studentId', {
    sittingId: sitting._id,
    studentId: { $nin: submitted },
    ...(classId ? { classIds: classId } : {}),
  });
}

const RESULT_SORTS = ['stt', 'name', 'correct', 'wrong'];
const RESULT_DIRS = ['asc', 'desc'];
const RESULT_STATUS_FILTERS: Record<string, Obj> = {
  pending: { gradingStatus: { $exists: true, $ne: null, $nin: ['none', 'done', 'manual'] } },
  done: { gradingStatus: { $in: ['done', 'manual'] } },
  stale: { essayStale: true },
  cheat: { 'tabViolations.0': { $exists: true } },
  auto: { isAutoSubmitted: true },
  none: { gradingStatus: { $in: ['none', null] } },
};
const NOT_SUBMITTED = 'not_submitted';
/** Empty -> default; outside the list -> false (400). */
const parseChoice = (raw: string | null, allowed: string[], fallback: string): string | false =>
  raw === null || raw === '' ? fallback : allowed.includes(raw) ? raw : false;

type Row = Record<string, unknown> & {
  studentId: Types.ObjectId;
  classIds: Types.ObjectId[];
  tabViolations?: unknown[];
};
/**
 * A page of submissions for sort by correct/wrong, name desc or a status filter. wrong = totalQuestions - correctCount and every submission of a sitting
 * has the same totalQuestions, so wrong asc == correctCount desc.
 * shortcut: sorted in MongoDB over one sitting's set (no new index); upgrade with an index {sittingId, correctCount} when a sitting passes ~10k submissions.
 */
async function loadCustomPage(a: {
  filter: Obj;
  studentIds: Types.ObjectId[];
  search: string | null;
  paging: { skip: number; limit: number };
  sort: string;
  dir: string;
  status: string;
}) {
  const subFilter: Obj = { ...a.filter, ...(RESULT_STATUS_FILTERS[a.status] ?? {}) };
  const key = toSearchKey(a.search ?? '');
  if (key)
    subFilter.studentId = {
      $in: await UserModel.distinct('_id', {
        _id: { $in: a.studentIds },
        nameSearch: { $regex: escapeRegExp(key) },
      }),
    };
  const dirNum = a.dir === 'asc' ? 1 : -1;
  if (a.sort === 'correct' || a.sort === 'wrong') {
    const [rows, total] = await Promise.all([
      SittingSubmissionModel.find(subFilter)
        .select('-__v')
        .sort({ correctCount: a.sort === 'wrong' ? -dirNum : dirNum, studentId: 1 } as never)
        .skip(a.paging.skip)
        .limit(a.paging.limit)
        .lean(),
      SittingSubmissionModel.countDocuments(subFilter),
    ]);
    const names = await UserModel.find({ _id: { $in: rows.map((r) => r.studentId) } })
      .select('fullName')
      .lean();
    const nameOf = new Map(names.map((u) => [String(u._id), u.fullName]));
    return {
      rows: rows as unknown as Row[],
      total,
      users: rows.map((r) => ({
        _id: r.studentId,
        fullName: nameOf.get(String(r.studentId)) ?? '',
      })),
    };
  }
  const ids = await SittingSubmissionModel.distinct('studentId', subFilter);
  const [users, total] = await Promise.all([
    UserModel.find({ _id: { $in: ids } })
      .select('fullName')
      .sort({ fullName: dirNum, _id: dirNum } as never)
      .collation({ locale: 'vi' })
      .skip(a.paging.skip)
      .limit(a.paging.limit)
      .lean(),
    UserModel.countDocuments({ _id: { $in: ids } }),
  ]);
  const rows = await SittingSubmissionModel.find({
    ...subFilter,
    studentId: { $in: users.map((u) => u._id) },
  })
    .select('-__v')
    .lean();
  return { rows: rows as unknown as Row[], total, users };
}

/**
 * GET /api/sittings/:id/results?classId&search&page&limit&notSubmittedPage&notSubmittedLimit&sort&dir&status&includeTeacher&classQ
 * Submissions of the sitting by page (50, by CURRENT name, searchable). Stats are over ALL submissions of the filtered class (not the search/page).
 */
export async function getResults(req: Request, ctx: AuthCtx): Promise<Response> {
  const sitting = await owned(ctx);
  const params = new URL(req.url).searchParams;
  const classId = parseClassFilter(params.get('classId'));
  if (classId === false) throw bad('Mã lớp không hợp lệ.');
  const paging = parsePage(params, { defaultLimit: PAGE_SIZE, maxLimit: 100 });
  const nsParams = new URLSearchParams();
  nsParams.set('page', params.get('notSubmittedPage') ?? '');
  nsParams.set('limit', params.get('notSubmittedLimit') ?? '');
  const nsPaging = parsePage(nsParams, { defaultLimit: PAGE_SIZE, maxLimit: 100 });
  const includeTeacher = ['1', 'true'].includes(String(params.get('includeTeacher')));
  const classQ = (params.get('classQ') ?? '').trim().slice(0, 100);
  const classRe = classQ ? new RegExp(escapeRegExp(classQ), 'i') : null;
  const classIdsByQ = classRe
    ? (
        await ClassModel.find({
          _id: { $in: sitting.classIds },
          $or: [{ name: classRe }, { code: classRe }],
        })
          .select('_id')
          .lean()
      ).map((c) => c._id)
    : null;
  const filter: Obj = {
    sittingId: sitting._id,
    ...(classId ? { classIds: classId } : {}),
    ...(classIdsByQ ? { $and: [{ classIds: { $in: classIdsByQ } }] } : {}),
    ...(includeTeacher ? {} : { byTeacher: { $ne: true } }),
  };
  const sort = parseChoice(params.get('sort'), RESULT_SORTS, 'name');
  const dir = parseChoice(params.get('dir'), RESULT_DIRS, 'asc');
  const status = parseChoice(
    params.get('status'),
    [...Object.keys(RESULT_STATUS_FILTERS), NOT_SUBMITTED],
    '',
  );
  if (sort === false) throw bad('sort chỉ nhận stt, name, correct hoặc wrong.');
  if (dir === false) throw bad('dir chỉ nhận asc hoặc desc.');
  if (status === false) throw bad('status không hợp lệ.');
  const search = params.get('search');

  const [statRows, studentIds, pendingIds] = await Promise.all([
    SittingSubmissionModel.find(filter)
      .select('score gradingStatus essayResults.questionId')
      .lean(),
    SittingSubmissionModel.distinct('studentId', filter),
    notSubmittedIds(sitting, classId),
  ]);
  const stats = {
    totalSubmissions: statRows.length,
    ...summarizeStats(statRows.map((row) => computeEssayDisplay(row, sitting.questions))),
  };

  const custom =
    status === NOT_SUBMITTED
      ? { users: [] as { _id: Types.ObjectId; fullName: string }[], total: 0, rows: [] as Row[] }
      : sort === 'correct' || sort === 'wrong' || status || dir === 'desc'
        ? await loadCustomPage({ filter, studentIds, search, paging, sort, dir, status })
        : null;
  const hasSearch = Boolean(toSearchKey(search ?? ''));
  const existing = await UserModel.distinct('_id', { _id: { $in: studentIds } });
  const existingSet = new Set(existing.map(String));
  // submissions whose account is gone still show (name empty), after the named ones
  const orphans = hasSearch
    ? []
    : studentIds
        .filter((id) => !existingSet.has(String(id)))
        .sort((a, b) => String(a).localeCompare(String(b)));
  const [named, pending] = await Promise.all([
    custom
      ? Promise.resolve({ users: [] as { _id: Types.ObjectId; fullName: string }[], total: 0 })
      : pageUsers(existing as Types.ObjectId[], search, paging),
    pageUsers(pendingIds, search, nsPaging),
  ]);
  const total = custom ? custom.total : named.total + orphans.length;
  const orphanStart = Math.max(0, paging.skip - named.total);
  const pageOrphans = orphans.slice(
    orphanStart,
    orphanStart + Math.max(0, paging.limit - named.users.length),
  );
  const users = custom
    ? custom.users
    : [...named.users, ...pageOrphans.map((id) => ({ _id: id, fullName: '' }))];
  const order = new Map(users.map((u, i) => [String(u._id), i]));
  const rows: Row[] = custom
    ? custom.rows
    : ((await SittingSubmissionModel.find({
        ...filter,
        studentId: { $in: users.map((u) => u._id) },
      })
        .select('-__v')
        .lean()) as unknown as Row[]);
  rows.sort(
    (a, b) => (order.get(String(a.studentId)) ?? 0) - (order.get(String(b.studentId)) ?? 0),
  );
  const nameOf = new Map(users.map((u) => [String(u._id), u.fullName]));
  const classNames = await classNameMap(
    [...new Set([...sitting.classIds, ...rows.flatMap((r) => r.classIds)].map(String))].map(
      (id) => toObjectId(id) as Types.ObjectId,
    ),
  );

  const submissions = rows.map((row) => ({
    ...row,
    studentName: nameOf.get(String(row.studentId)) ?? '',
    classNames: row.classIds.map((id) => classNames.get(String(id))?.name ?? ''),
    violationCount: row.tabViolations?.length ?? 0,
    ...computeEssayDisplay(row as never, sitting.questions),
  }));
  return ok({
    exam: examInfo(sitting),
    classes: sitting.classIds.map((id) => ({
      id: String(id),
      name: classNames.get(String(id))?.name ?? '',
    })),
    stats,
    submissions,
    pagination: pageResult([], total, paging),
    notSubmitted: await describeNotSubmitted(sitting, pending.users, { withPhone: true }),
    notSubmittedPagination: pageResult([], pending.total, nsPaging),
  });
}

/** Every submission (no paging) for the client-side CSV: only current name + scores + status, no answers/essays/phone. null when over maxRows. */
async function collectResultsExport(
  sitting: Sitting,
  classId: Types.ObjectId | null,
  maxRows = Infinity,
) {
  const filter = {
    sittingId: sitting._id,
    ...(classId ? { classIds: classId } : {}),
    byTeacher: { $ne: true },
  };
  if (Number.isFinite(maxRows)) {
    const [count, pending] = await Promise.all([
      SittingSubmissionModel.countDocuments(filter),
      notSubmittedIds(sitting, classId),
    ]);
    if (count + pending.length > maxRows) return null; // checked before loading the submissions into memory
  }
  const [rows, pendingIds] = await Promise.all([
    SittingSubmissionModel.find(filter)
      .select(
        'studentId classIds score mcqScore essayScore maxScore correctCount totalQuestions gradingStatus essayResults.questionId essayResults.criteria essayResults.total essayResults.feedback essayResults.source essayResults.teacherOverride essayStale startedAt submittedAt timeSpentSeconds isAutoSubmitted tabViolations',
      )
      .lean(),
    notSubmittedIds(sitting, classId),
  ]);
  const users = await UserModel.find({
    _id: { $in: [...rows.map((r) => r.studentId), ...pendingIds] },
  })
    .select('fullName')
    .lean();
  const nameOf = new Map(users.map((u) => [String(u._id), u.fullName]));
  const byName = (a: { studentName: string }, b: { studentName: string }) =>
    a.studentName.localeCompare(b.studentName, 'vi');
  const classNames = await classNameMap(
    [...new Set([...sitting.classIds, ...rows.flatMap((r) => r.classIds)].map(String))].map(
      (id) => toObjectId(id) as Types.ObjectId,
    ),
  );
  const submissions = rows
    .map(({ tabViolations, essayResults, ...row }) => ({
      ...row,
      essayResults,
      studentName: nameOf.get(String(row.studentId)) ?? '',
      classNames: row.classIds.map((id) => classNames.get(String(id))?.name ?? ''),
      violationCount: tabViolations?.length ?? 0,
      ...computeEssayDisplay({ ...row, essayResults }, sitting.questions),
    }))
    .sort(byName);
  const pendingUsers = pendingIds.map((id) => ({
    _id: id,
    fullName: nameOf.get(String(id)) ?? '',
  }));
  const notSubmitted = (await describeNotSubmitted(sitting, pendingUsers)).sort(byName);
  const essayQuestions = (sitting.questions as unknown as Question[])
    .map((q, i) => ({ q, number: i + 1 }))
    .filter(({ q }) => isEssayQuestion(q))
    .map(({ q, number }) => ({
      id: q.id,
      number,
      maxScore: q.maxScore as number,
      rubric: (q.rubric ?? []).map((r) => ({ key: r.key, label: r.label, max: r.max })),
    }));
  return {
    exam: { id: String(sitting._id), title: sitting.title, essayQuestions },
    submissions,
    notSubmitted,
  };
}

export async function exportResults(req: Request, ctx: AuthCtx): Promise<Response> {
  const sitting = await owned(ctx);
  const classId = parseClassFilter(new URL(req.url).searchParams.get('classId'));
  if (classId === false) throw bad('Mã lớp không hợp lệ.');
  return ok(await collectResultsExport(sitting, classId));
}

/** .xlsx with the same permission/validation as the JSON export (at most RESULTS_XLSX_MAX_ROWS rows). */
export async function exportResultsXlsx(req: Request, ctx: AuthCtx): Promise<Response> {
  const sitting = await owned(ctx);
  const classId = parseClassFilter(new URL(req.url).searchParams.get('classId'));
  if (classId === false) throw bad('Mã lớp không hợp lệ.');
  const data = await collectResultsExport(sitting, classId, RESULTS_XLSX_MAX_ROWS);
  if (!data)
    throw new HttpError(
      'EXPORT_TOO_LARGE',
      `Ca thi có hơn ${RESULTS_XLSX_MAX_ROWS} dòng, vui lòng lọc theo lớp để xuất từng phần.`,
    );
  const buffer = await renderXlsx(
    buildResultsSheet({
      sittingTitle: sitting.title,
      essayQuestions: data.exam.essayQuestions,
      submissions: data.submissions as never,
      notSubmitted: data.notSubmitted,
      hasMcq: (sitting.questions as unknown as Question[]).some((q) => !isEssayQuestion(q)),
    }),
  );
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': XLSX_MIME,
      'Content-Disposition': contentDisposition(sitting.title),
      'Cache-Control': 'no-store',
    },
  });
}

/** GET /api/sittings/:id/grading-progress: how many essay submissions are graded / pending. The owner's trial submissions do not count. */
export async function getGradingProgress(_req: Request, ctx: AuthCtx): Promise<Response> {
  const sitting = await owned(ctx);
  const [bySubmission, staleCount] = await Promise.all([
    SittingSubmissionModel.aggregate<{ _id: string; count: number }>([
      { $match: { sittingId: sitting._id, byTeacher: { $ne: true } } },
      { $group: { _id: '$gradingStatus', count: { $sum: 1 } } },
    ]),
    SittingSubmissionModel.countDocuments({
      sittingId: sitting._id,
      essayStale: true,
      byTeacher: { $ne: true },
    }),
  ]);
  const submissions = Object.fromEntries(bySubmission.map((r) => [r._id, r.count])) as Record<
    string,
    number
  >;
  const essaySubmissions = Object.entries(submissions).reduce(
    (sum, [status, count]) => (status === 'none' ? sum : sum + count),
    0,
  );
  const finished = submissions.done ?? 0;
  return ok({
    sittingId: String(sitting._id),
    scoring: computeScoring(sitting.questions as unknown as Question[]),
    essaySubmissions,
    finished,
    pendingManualCount: essaySubmissions - finished,
    submissions,
    staleCount,
  });
}

/** Fresh submission (with display fields computed on the server) for the client after saving or on a 409. */
async function loadGradingView(submissionId: Types.ObjectId, sitting: Sitting) {
  const fresh = await SittingSubmissionModel.findById(submissionId)
    .select('score mcqScore essayScore maxScore essayResults gradingStatus')
    .lean();
  return { ...fresh, ...computeEssayDisplay(fresh as never, sitting.questions) };
}

function parseBaseGradedAt(
  body: Obj,
): { lock: false } | { lock: true; expected: Date | null } | { error: true } {
  if (
    !Object.prototype.hasOwnProperty.call(body, 'baseGradedAt') ||
    body.baseGradedAt === undefined
  )
    return { lock: false };
  if (body.baseGradedAt === null) return { lock: true, expected: null };
  if (typeof body.baseGradedAt !== 'string' && typeof body.baseGradedAt !== 'number')
    return { error: true };
  const date = new Date(body.baseGradedAt);
  return Number.isNaN(date.getTime()) ? { error: true } : { lock: true, expected: date };
}

/**
 * PUT /api/sittings/:id/submissions/:submissionId/essay/:questionId
 * Grade/edit one essay by hand: each criterion 0..max and a multiple of 0.25; the total <= the question's points (400, never silently clamped);
 * optional optimistic lock `baseGradedAt` (mismatch -> 409 with the fresh data). Independent of the grant.
 */
export async function overrideEssayResult(req: Request, ctx: AuthCtx): Promise<Response> {
  const sitting = await owned(ctx);
  const submission = await loadSubmissionOfSitting(ctx, sitting);
  if (!submission) throw submissionNotFound();
  const rawQuestionId = (await paramsOf(ctx)).questionId;
  if (!POSITIVE_INTEGER_PATTERN.test(String(rawQuestionId))) throw bad('Mã câu hỏi không hợp lệ.');
  const questionId = Number(rawQuestionId);
  const question = (sitting.questions as unknown as Question[]).find(
    (q) => q.id === questionId && isEssayQuestion(q),
  );
  if (!question) throw new HttpError('NOT_FOUND', 'Không tìm thấy câu tự luận.');
  const rubric = question.rubric ?? [];

  const raw = await readJson(req, 64 * 1024);
  const body = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Obj;
  const errors: string[] = [];
  if (body.criteria !== undefined && !Array.isArray(body.criteria))
    errors.push('Danh sách tiêu chí (criteria) phải là một mảng.');
  const incoming = (Array.isArray(body.criteria) ? body.criteria : []) as unknown[];
  if (incoming.length > rubric.length)
    errors.push(`Chỉ có ${rubric.length} tiêu chí trong câu này.`);
  if (body.feedback !== undefined && typeof body.feedback !== 'string')
    errors.push('Nhận xét chung (feedback) phải là chuỗi.');
  const lockInfo = parseBaseGradedAt(body);
  if ('error' in lockInfo) errors.push('baseGradedAt không hợp lệ (null hoặc thời điểm ISO).');
  if (errors.length > 0) throw bad(errors.join(' '));

  const existing = (submission.essayResults ?? []).find((r) => r.questionId === questionId);
  const scoreByKey = new Map(
    (existing?.criteria ?? []).map((c) => [c.key, { score: c.score, comment: c.comment }]),
  );
  const seenKeys = new Set<string>();
  for (const item of incoming) {
    const it = item as { key?: unknown; score?: unknown; comment?: unknown } | null;
    if (!it || typeof it !== 'object' || Array.isArray(it) || typeof it.key !== 'string') {
      errors.push('Mỗi tiêu chí phải là đối tượng có "key" dạng chuỗi.');
      continue;
    }
    const key = it.key;
    if (seenKeys.has(key)) {
      errors.push(`Tiêu chí "${key}" bị gửi trùng.`);
      continue;
    }
    seenKeys.add(key);
    const rubricItem = rubric.find((r) => r.key === key);
    if (!rubricItem) {
      errors.push(`Tiêu chí "${key}" không thuộc câu này.`);
      continue;
    }
    const current = scoreByKey.get(key) ?? { score: 0, comment: '' };
    let { score } = current;
    if (it.score !== undefined) {
      score = typeof it.score === 'number' ? it.score : NaN;
      if (!Number.isFinite(score) || score < 0 || score > rubricItem.max || !isQuarterStep(score)) {
        errors.push(
          `Điểm tiêu chí "${key}" phải là bội số của ${SCORE_STEP}, từ 0 đến ${rubricItem.max}.`,
        );
        continue;
      }
    }
    if (it.comment !== undefined && typeof it.comment !== 'string') {
      errors.push(`Nhận xét tiêu chí "${key}" phải là chuỗi.`);
      continue;
    }
    const comment =
      it.comment === undefined
        ? current.comment
        : it.comment.replace(/[<>]/g, '').trim().slice(0, MAX_COMMENT_CHARS);
    scoreByKey.set(key, { score, comment });
  }
  if (errors.length > 0) throw bad(errors.join(' '));
  if (incoming.length === 0 && body.feedback === undefined)
    throw bad('Không có nội dung nào để cập nhật.');

  const criteria = rubric.map((r) => ({
    key: r.key,
    score: scoreByKey.get(r.key)?.score ?? 0,
    comment: scoreByKey.get(r.key)?.comment ?? '',
  }));
  const total = roundTo2(criteria.reduce((sum, c) => sum + c.score, 0));
  if (total > (question.maxScore ?? 0) + 1e-9)
    throw bad(
      `Tổng điểm các tiêu chí (${total}) vượt quá điểm tối đa của câu (${question.maxScore}).`,
    );

  const conflict = async () =>
    new HttpError('GRADE_CONFLICT', 'Bài vừa được sửa ở nơi khác, hãy tải lại trước khi lưu.', {
      data: await loadGradingView(submission._id, sitting),
    });
  let expectedGradedAt: Date | null | undefined;
  if ('lock' in lockInfo && lockInfo.lock) {
    expectedGradedAt = lockInfo.expected;
    const currentMs = existing?.gradedAt ? new Date(existing.gradedAt).getTime() : null;
    const expectedMs = expectedGradedAt === null ? null : expectedGradedAt.getTime();
    if (currentMs !== expectedMs) throw await conflict();
  }
  const feedback =
    body.feedback === undefined
      ? (existing?.feedback ?? '')
      : (body.feedback as string).replace(/[<>]/g, '').trim().slice(0, MAX_FEEDBACK_CHARS);

  const entry: IEssayResult = {
    questionId,
    criteria,
    total,
    feedback,
    gradedAt: new Date(),
    source: 'teacher',
    teacherOverride: true,
  };
  const written = await upsertEssayResult(
    submission._id,
    entry,
    expectedGradedAt !== undefined ? { expectedGradedAt } : {},
  );
  if (!written) {
    if (expectedGradedAt !== undefined) throw await conflict();
    throw new HttpError('busy', 'Chưa lưu được vì dữ liệu bài vừa thay đổi, vui lòng thử lại.');
  }
  await recomputeScores(submission._id);
  await refreshSubmissionStatus(submission._id);
  if (submission.essayStale === true) {
    try {
      await clearEssayStaleIfRegraded(submission._id, sitting.questions);
    } catch (e) {
      console.error('Cannot clear essayStale after grading:', (e as Error).message);
    }
  }
  const answer = (submission.essayAnswers ?? []).find((a) => a.questionId === questionId);
  if (answer?.source === 'file-media')
    await scheduleMediaRetention(submission._id, questionId, loadEssayUploadConfig()).catch((e) =>
      console.error('Cannot extend the media retention:', (e as Error).message),
    );
  return ok({
    ...(await loadGradingView(submission._id, sitting)),
    resultsPublished: sitting.resultsPublishedAt != null,
  });
}

/** GET .../submissions/:submissionId/essay/:questionId/media: the original photo/PDF of a submission of this sitting, owner only. */
export async function getEssayMedia(_req: Request, ctx: AuthCtx): Promise<Response> {
  const sitting = await owned(ctx);
  const submission = await loadSubmissionOfSitting(ctx, sitting, 'essayAnswers');
  if (!submission) throw submissionNotFound();
  const questionId = Number((await paramsOf(ctx)).questionId);
  const answer = (submission.essayAnswers ?? []).find((a) => a.questionId === questionId);
  if (!answer || answer.source !== 'file-media' || !answer.mediaRef)
    throw new HttpError('NOT_FOUND', 'Câu này không có tệp ảnh/PDF gốc.');
  const media = await EssayMediaModel.findOne({
    _id: answer.mediaRef,
    submissionId: submission._id,
    sittingId: sitting._id,
    questionId,
  }).lean();
  return sendEssayMedia(media, submission._id, questionId);
}

/**
 * DELETE .../submissions/:submissionId/violations/:index[?at=<ISO>]: remove one violation entry with ONE atomic write (slice by index, only when the
 * index is still inside the array). `at` (optional): the timestamp of the entry the client is looking at; the array changed meanwhile -> 409, never a wrong delete.
 */
export async function deleteViolationLog(req: Request, ctx: AuthCtx): Promise<Response> {
  const sitting = await owned(ctx);
  const submission = await loadSubmissionOfSitting(ctx, sitting, '_id');
  if (!submission) throw submissionNotFound();
  const rawIndex = (await paramsOf(ctx)).index;
  const idx = /^\d{1,9}$/.test(String(rawIndex)) ? Number(rawIndex) : -1;
  if (idx < 0) throw bad('Chỉ mục vi phạm không hợp lệ.');
  const guard: unknown[] = [{ $gt: [{ $size: { $ifNull: ['$tabViolations', []] } }, idx] }];
  const atRaw = new URL(req.url).searchParams.get('at');
  if (atRaw !== null) {
    const at = new Date(atRaw);
    if (Number.isNaN(at.getTime())) throw bad('Mốc thời gian (at) không hợp lệ.');
    guard.push({ $eq: [{ $arrayElemAt: ['$tabViolations.at', idx] }, at] });
  }
  const done = await SittingSubmissionModel.updateOne(
    { _id: submission._id, $expr: { $and: guard } } as never,
    [
      {
        $set: {
          tabViolations: {
            $concatArrays: [
              idx === 0 ? [] : { $slice: ['$tabViolations', idx] },
              { $slice: ['$tabViolations', idx + 1, 1000000] },
            ],
          },
        },
      },
    ], // $slice does not take n = 0
    { updatePipeline: true },
  );
  const fresh = await SittingSubmissionModel.findById(submission._id)
    .select('tabViolations')
    .lean();
  const violations = (fresh?.tabViolations ?? []).map((v) => ({
    at: v.at.toISOString(),
    reason: v.reason,
  }));
  if (done.matchedCount === 0) {
    if (idx < violations.length)
      throw new HttpError('VIOLATION_CHANGED', 'Log vi phạm vừa thay đổi, hãy tải lại.', {
        data: { tabViolations: violations },
      });
    throw bad('Chỉ mục vi phạm không hợp lệ.');
  }
  return ok({ tabViolations: violations }, { message: 'Đã xóa log vi phạm.' });
}

// ---- publication
/** GET /api/sittings/:id/publication */
export async function getPublication(_req: Request, ctx: AuthCtx): Promise<Response> {
  const sitting = await owned(ctx);
  return ok(await getPublicationInfo(sitting as never));
}

/** POST /api/sittings/:id/results/publish: idempotent; an already published sitting keeps its publishedAt. */
export async function publishResults(_req: Request, ctx: AuthCtx): Promise<Response> {
  const sitting = await owned(ctx);
  const done = (publishedAt: Date, alreadyPublished: boolean) =>
    ok(
      { publishedAt: publishedAt.toISOString(), alreadyPublished },
      { message: alreadyPublished ? 'Kết quả đã được công bố trước đó.' : 'Đã công bố kết quả.' },
    );
  if (sitting.resultsPublishedAt) return done(sitting.resultsPublishedAt, true);
  const now = new Date();
  const info = await countSubmissions(sitting as never);
  if (info.ungradedCount > 0)
    throw new HttpError(
      'GRADING_INCOMPLETE',
      `Còn ${info.ungradedCount} bài chưa chấm xong, chưa thể công bố.`,
      {
        data: { ungradedCount: info.ungradedCount, staleCount: info.staleCount },
      },
    );
  if (await publishAtomic(sitting, now)) return done(now, false);
  const fresh = await ExamSittingModel.findOne({ _id: sitting._id, createdBy: ctx.user._id })
    .select('resultsPublishedAt closeAt')
    .lean();
  if (!fresh) throw notFound();
  if (fresh.resultsPublishedAt) return done(fresh.resultsPublishedAt, true);
  return done(now, true);
}

/** POST /api/sittings/:id/results/unpublish: always allowed, idempotent. */
export async function unpublishResults(_req: Request, ctx: AuthCtx): Promise<Response> {
  const sitting = await owned(ctx);
  await ExamSittingModel.updateOne(
    { _id: sitting._id, createdBy: ctx.user._id },
    { $set: { resultsPublishedAt: null } },
  );
  return ok({ publishedAt: null }, { message: 'Đã thu hồi công bố kết quả.' });
}
