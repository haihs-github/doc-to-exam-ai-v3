// Created by Haihs on 12/11/2026
// Teacher-side sitting use cases: candidates, create/read/update/delete, regenerate code, change classes, grants. Port of server/controllers/sittingController.js.
import type { Types } from 'mongoose';
import { ok, pageResult, parsePage, toObjectId } from '../lib/apiResponse';
import type { AuthCtx } from '../lib/auth';
import { sanitizeQuestions } from '../lib/examValidation';
import { HttpError, readJson } from '../lib/handler';
import { minuteWindow } from '../lib/sittingOverlap';
import { escapeRegExp, LIMITS, toSearchKey } from '../lib/textUtils';
import { ClassModel } from '../models/Class';
import { ClassMemberModel } from '../models/ClassMember';
import { EssayMediaModel } from '../models/EssayMedia';
import { EssayUploadModel } from '../models/EssayUpload';
import { ExamSittingModel } from '../models/ExamSitting';
import { ExamTemplateModel } from '../models/ExamTemplate';
import { SittingGrantModel } from '../models/SittingGrant';
import { SittingSessionModel } from '../models/SittingSession';
import { SittingSubmissionModel } from '../models/SittingSubmission';
import { UserModel } from '../models/User';
import { essaySignature, regradeSittingSubmissions } from './regrade';
import { withUniqueSittingCode } from './sittingCode';
import { getSittingAvailability } from './sittingLookup';
import { TEMPLATE_JSON_MAX } from './templates';

const SUBMIT_GRACE_MS = 120 * 1000; // grace to submit after deadlineAt (same as the submit flow)
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000; // session expiresAt = deadlineAt + 30 days
const MAX_DATE_MS = 253402300799999; // 31/12/9999: keeps expiresAt a valid date
const PAGE_SIZE = 50;
const STATUSES = ['not_started', 'open', 'ended'];

type Obj = Record<string, unknown>;
const bad = (message: string, field?: string) =>
  new HttpError('VALIDATION', message, field ? { field } : undefined);
const notFound = () => new HttpError('NOT_FOUND', 'Không tìm thấy ca thi.');
const invalidClasses = () =>
  new HttpError(
    'INVALID_CLASSES',
    'Danh sách lớp không hợp lệ: lớp phải đang học, chưa xóa và bạn phải là giáo viên đã duyệt của lớp.',
  );
const invalidStudents = () =>
  new HttpError(
    'INVALID_STUDENTS',
    'Danh sách học sinh không hợp lệ: chỉ chọn học sinh đã duyệt của các lớp được gán.',
  );
const linkOf = (code: string) => `/ca/${code}`;
const paramsOf = async (ctx: AuthCtx) => ((await ctx.params) ?? {}) as Record<string, string>;
const bodyOf = async (req: Request, max = 1_048_576): Promise<Obj> => {
  const raw = await readJson(req, max);
  return (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Obj;
};

/** By id AND owner; malformed, missing and someone else's all give null (the same 404). */
export async function loadOwnedSitting(ctx: AuthCtx) {
  const id = toObjectId((await paramsOf(ctx)).id);
  return id ? ExamSittingModel.findOne({ _id: id, createdBy: ctx.user._id }) : null;
}

/** String ids -> de-duplicated ObjectIds; null when not an array or any element is malformed. */
function parseIdList(raw: unknown): Types.ObjectId[] | null {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  const ids: Types.ObjectId[] = [];
  for (const value of raw) {
    const id = toObjectId(value);
    if (!id) return null;
    if (!seen.has(String(id))) {
      seen.add(String(id));
      ids.push(id);
    }
  }
  return ids;
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const date = new Date(value);
  const ms = date.getTime();
  return Number.isNaN(ms) || ms > MAX_DATE_MS ? null : date;
}
/** Safe integer >= 1 small enough that now + duration is still a valid Date. */
const isValidDuration = (v: unknown): v is number =>
  typeof v === 'number' &&
  Number.isSafeInteger(v) &&
  v >= 1 &&
  Date.now() + v * 60000 <= MAX_DATE_MS;

/** Every class is active (not deleted) and the caller is an approved teacher of each. */
async function areTeachableActiveClasses(
  userId: Types.ObjectId,
  classIds: Types.ObjectId[],
): Promise<boolean> {
  const [active, teaching] = await Promise.all([
    ClassModel.countDocuments({ _id: { $in: classIds }, status: 'active' }), // the plugin already hides deleted classes
    ClassMemberModel.countDocuments({
      classId: { $in: classIds },
      userId,
      memberRole: 'teacher',
      status: 'approved',
    }),
  ]);
  return active === classIds.length && teaching === classIds.length;
}

/**
 * First shared class code that has ANOTHER sitting (not excludeId, not yet closed incl. grace) opening in the SAME minute; null when none.
 * Scans every teacher (classes are shared). Only the class code is returned, never the other sitting's name/time/teacher.
 * shortcut: check-then-write is not atomic (two concurrent requests can both pass and create two clashing sittings); add a per-class lock/constraint if abused.
 */
async function findOverlapClassCode(
  classIds: Types.ObjectId[],
  openAt: Date,
  excludeId: Types.ObjectId | null,
): Promise<string | null> {
  const { from, to } = minuteWindow(openAt);
  const other = await ExamSittingModel.findOne({
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    classIds: { $in: classIds },
    openAt: { $gte: from, $lt: to },
    closeAt: { $gt: new Date(Date.now() - SUBMIT_GRACE_MS) },
  })
    .select('classIds')
    .lean();
  if (!other) return null;
  const wanted = new Set(classIds.map(String));
  const sharedId = other.classIds.find((id) => wanted.has(String(id)));
  const shared = await ClassModel.findById(sharedId)
    .select('code')
    .setOptions({ withDeleted: true })
    .lean();
  return shared?.code ?? '';
}
const overlapError = (code: string) =>
  new HttpError('SITTING_OVERLAP', `Lớp ${code || 'đã chọn'} đã có ca thi trùng giờ mở.`);

const liveClassIds = async (classIds: Types.ObjectId[]) =>
  (
    await ClassModel.find({ _id: { $in: classIds } })
      .select('_id')
      .lean()
  ).map((c) => c._id);
const approvedStudentFilter = (classIds: Types.ObjectId[], extra: Obj = {}) => ({
  classId: { $in: classIds },
  memberRole: 'student' as const,
  status: 'approved' as const,
  ...extra,
});

/** One page of students (by name, vi collation) among the given ids, filtered by an accent-less name key. */
async function pageUsers(
  ids: Types.ObjectId[],
  q: string | null,
  paging: { skip: number; limit: number },
) {
  const filter: Obj = { _id: { $in: ids } };
  const key = toSearchKey(q ?? '');
  if (key) filter.nameSearch = { $regex: escapeRegExp(key) };
  const [users, total] = await Promise.all([
    UserModel.find(filter)
      .select('fullName')
      .sort({ fullName: 1, _id: 1 })
      .collation({ locale: 'vi' })
      .skip(paging.skip)
      .limit(paging.limit)
      .lean(),
    UserModel.countDocuments(filter),
  ]);
  return { users, total };
}

/**
 * Chosen students of the classes. allInClasses: EVERY approved student of classIds minus excludeStudentIds (studentIds ignored);
 * otherwise studentIds. Returns Map id -> {id, classIds}, or null when invalid (unknown id, outside the classes, empty list).
 */
async function resolveStudents(body: Obj, classIds: Types.ObjectId[], { allowEmpty = false } = {}) {
  if (body.allInClasses !== undefined && typeof body.allInClasses !== 'boolean') return null;
  const all = body.allInClasses === true;
  const listed = all ? parseIdList(body.excludeStudentIds ?? []) : parseIdList(body.studentIds);
  if (!listed) return null;
  const members = await ClassMemberModel.find(
    approvedStudentFilter(classIds, all ? {} : { userId: { $in: listed } }),
  )
    .select('classId userId')
    .lean();
  const picked = new Map<string, { id: Types.ObjectId; classIds: Types.ObjectId[] }>();
  for (const m of members) {
    const entry = picked.get(String(m.userId)) ?? { id: m.userId, classIds: [] };
    entry.classIds.push(m.classId);
    picked.set(String(m.userId), entry);
  }
  if (all) {
    if (listed.some((id) => !picked.has(String(id)))) return null; // excluding someone outside the assigned classes
    listed.forEach((id) => picked.delete(String(id)));
  } else if ((listed.length === 0 && !allowEmpty) || picked.size !== listed.length) return null;
  return picked.size === 0 && !allowEmpty ? null : picked;
}

async function classNameMap(classIds: Types.ObjectId[]) {
  const classes = await ClassModel.find({ _id: { $in: classIds } })
    .select('name status deletedAt')
    .setOptions({ withDeleted: true })
    .lean();
  return new Map(classes.map((c) => [String(c._id), c]));
}

type SittingLike = {
  _id: Types.ObjectId;
  title: string;
  description: string;
  templateId: Types.ObjectId | null;
  templateTitle: string;
  classIds: Types.ObjectId[];
  openAt: Date;
  closeAt: Date;
  durationMinutes: number;
  shuffleQuestions: boolean;
  antiCheat: boolean;
  code: string;
  totalQuestions: number;
  scoring: { mcqMax: number; essayMax: number };
  resultsPublishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
export const toSummary = (
  s: SittingLike,
  now: Date,
  counts?: { grantedCount: number; submittedCount: number },
) => ({
  id: String(s._id),
  title: s.title,
  description: s.description,
  templateId: s.templateId ? String(s.templateId) : null,
  templateTitle: s.templateTitle,
  classIds: s.classIds.map(String),
  openAt: s.openAt.toISOString(),
  closeAt: s.closeAt.toISOString(),
  durationMinutes: s.durationMinutes,
  shuffleQuestions: s.shuffleQuestions,
  antiCheat: s.antiCheat,
  code: s.code,
  link: linkOf(s.code),
  totalQuestions: s.totalQuestions,
  scoring: s.scoring,
  status: getSittingAvailability(s, now).status,
  resultsPublishedAt: s.resultsPublishedAt ? s.resultsPublishedAt.toISOString() : null,
  createdAt: s.createdAt.toISOString(),
  updatedAt: s.updatedAt.toISOString(),
  ...counts,
});

// the owner's own trial submissions (byTeacher) do not count
const hasSubmissions = async (sittingId: Types.ObjectId) =>
  Boolean(await SittingSubmissionModel.exists({ sittingId, byTeacher: { $ne: true } }));
const activeSessionFilter = (sittingId: Types.ObjectId, now: Date) => ({
  sittingId,
  deadlineAt: { $gte: new Date(now.getTime() - SUBMIT_GRACE_MS) },
});

/** Question lock: the sitting is OPEN and (has submissions OR has unsubmitted sessions within deadline + grace). */
async function getLock(
  sitting: { _id: Types.ObjectId; openAt: Date; closeAt: Date },
  now: Date,
): Promise<{ locked: boolean; reason: 'HAS_SUBMISSIONS' | 'ACTIVE_SESSIONS' | null }> {
  if (getSittingAvailability(sitting, now).status !== 'open')
    return { locked: false, reason: null };
  if (await hasSubmissions(sitting._id)) return { locked: true, reason: 'HAS_SUBMISSIONS' };
  if (await SittingSessionModel.exists(activeSessionFilter(sitting._id, now)))
    return { locked: true, reason: 'ACTIVE_SESSIONS' };
  return { locked: false, reason: null };
}

async function getTemplateStatus(s: {
  templateId: Types.ObjectId | null;
  createdBy: Types.ObjectId;
}) {
  if (!s.templateId) return 'purged' as const;
  const t = await ExamTemplateModel.findOne({ _id: s.templateId, createdBy: s.createdBy })
    .setOptions({ withDeleted: true })
    .select('deletedAt')
    .lean();
  if (!t) return 'purged' as const;
  return t.deletedAt ? ('deleted' as const) : ('active' as const);
}

async function buildDetail(doc: { toObject(): unknown }, now = new Date()) {
  const s = doc.toObject() as SittingLike & { questions: unknown[]; createdBy: Types.ObjectId };
  const [lock, activeSessionCount, names, live, templateStatus] = await Promise.all([
    getLock(s, now),
    SittingSessionModel.countDocuments(activeSessionFilter(s._id, now)),
    classNameMap(s.classIds),
    liveClassIds(s.classIds),
    getTemplateStatus(s),
  ]);
  const studentIds = await ClassMemberModel.distinct('userId', approvedStudentFilter(live));
  const granted = await SittingGrantModel.countDocuments({
    sittingId: s._id,
    studentId: { $in: studentIds },
  });
  return {
    ...toSummary(s, now),
    questions: s.questions,
    templateStatus,
    locked: lock.locked,
    lockReason: lock.reason,
    activeSessionCount,
    ungrantedInClassCount: studentIds.length - granted,
    classes: s.classIds.map((id) => {
      const c = names.get(String(id));
      return {
        id: String(id),
        name: c?.name ?? '',
        status: c?.status ?? null,
        deleted: Boolean(c?.deletedAt),
      };
    }),
  };
}

export async function candidates(req: Request, ctx: AuthCtx): Promise<Response> {
  const params = new URL(req.url).searchParams;
  const classIds = parseIdList((params.get('classIds') ?? '').split(',').filter(Boolean));
  if (
    !classIds ||
    classIds.length === 0 ||
    !(await areTeachableActiveClasses(ctx.user._id, classIds))
  )
    throw invalidClasses();
  const studentIds = await ClassMemberModel.distinct('userId', approvedStudentFilter(classIds));
  const paging = parsePage(params, { defaultLimit: PAGE_SIZE, maxLimit: PAGE_SIZE });
  const { users, total } = await pageUsers(studentIds, params.get('q'), paging);
  const members = await ClassMemberModel.find(
    approvedStudentFilter(classIds, { userId: { $in: users.map((u) => u._id) } }),
  )
    .select('classId userId')
    .lean();
  const classesOf = new Map<string, string[]>();
  for (const m of members)
    classesOf.set(String(m.userId), [
      ...(classesOf.get(String(m.userId)) ?? []),
      String(m.classId),
    ]);
  const items = users.map((u) => ({
    id: String(u._id),
    fullName: u.fullName,
    classIds: classesOf.get(String(u._id)) ?? [],
  }));
  return ok(pageResult(items, total, paging));
}

// per-teacher unique title: trim + collapse whitespace + lower-case (vi); a scan of the teacher's titles, no DB index
const titleKeyOf = (t: unknown): string =>
  String(t).trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');
async function titleTaken(
  teacherId: Types.ObjectId,
  title: string,
  exceptId: Types.ObjectId | null,
) {
  const key = titleKeyOf(title);
  const rows = await ExamSittingModel.find({
    createdBy: teacherId,
    ...(exceptId ? { _id: { $ne: exceptId } } : {}),
  })
    .select('title')
    .lean();
  return rows.some((r) => titleKeyOf(r.title) === key);
}
const titleTakenError = () =>
  new HttpError('SITTING_TITLE_TAKEN', 'Tên ca thi đã tồn tại. Vui lòng chọn tên khác!', {
    field: 'title',
  });

export async function createSitting(req: Request, ctx: AuthCtx): Promise<Response> {
  const body = await bodyOf(req);
  const templateId = toObjectId(body.templateId);
  const template = templateId
    ? await ExamTemplateModel.findOne({ _id: templateId, createdBy: ctx.user._id })
    : null;
  if (!template) throw new HttpError('NOT_FOUND', 'Không tìm thấy đề mẫu.');

  const title = body.title === undefined ? template.title : String(body.title ?? '').trim();
  if (!title) throw bad('Tên ca thi không được để trống.');
  const description =
    body.description === undefined ? template.description : String(body.description ?? '').trim();
  // a default title from an old long template is not blocked: only what the client sends is checked
  if (body.title !== undefined && title.length > LIMITS.TITLE_MAX)
    throw bad(`Tên ca thi tối đa ${LIMITS.TITLE_MAX} ký tự.`, 'title');
  if (body.description !== undefined && description.length > LIMITS.DESCRIPTION_MAX)
    throw bad(`Mô tả ca thi tối đa ${LIMITS.DESCRIPTION_MAX} ký tự.`, 'description');
  const openAt = parseDate(body.openAt);
  const closeAt = parseDate(body.closeAt);
  if (!openAt || !closeAt) throw bad('Giờ mở/đóng ca không hợp lệ.');
  if (closeAt <= openAt) throw bad('Giờ đóng ca phải sau giờ mở ca.');
  if (closeAt <= new Date()) throw bad('Giờ đóng ca phải ở tương lai.');
  if (!isValidDuration(body.durationMinutes))
    throw bad('Thời gian làm bài phải là số nguyên từ 1 phút trở lên.');
  for (const key of ['shuffleQuestions', 'antiCheat'])
    if (body[key] !== undefined && typeof body[key] !== 'boolean')
      throw bad(`${key} phải là true hoặc false.`);

  const classIds = parseIdList(body.classIds);
  if (
    !classIds ||
    classIds.length === 0 ||
    !(await areTeachableActiveClasses(ctx.user._id, classIds))
  )
    throw invalidClasses();
  const picked = await resolveStudents(body, classIds, { allowEmpty: true }); // a sitting with 0 students is allowed
  if (!picked) throw invalidStudents();
  if (await titleTaken(ctx.user._id, title, null)) throw titleTakenError();
  const overlap = await findOverlapClassCode(classIds, openAt, null);
  if (overlap !== null) throw overlapError(overlap);

  const sitting = await withUniqueSittingCode((code) =>
    new ExamSittingModel({
      createdBy: ctx.user._id,
      templateId: template._id,
      templateTitle: template.title,
      title,
      description,
      questions: structuredClone(
        (template.toObject() as unknown as { questions: unknown[] }).questions,
      ), // a COPY: later edits/deletes of the template do not change the sitting
      classIds,
      openAt,
      closeAt,
      durationMinutes: body.durationMinutes as number,
      shuffleQuestions: body.shuffleQuestions === true,
      antiCheat: body.antiCheat === true,
      code,
    }).save(),
  );
  try {
    if (picked.size > 0)
      await SittingGrantModel.insertMany(
        [...picked.values()].map(({ id, classIds: studentClassIds }) => ({
          sittingId: sitting._id,
          studentId: id,
          classIds: studentClassIds,
          grantedBy: ctx.user._id,
        })),
        { ordered: false },
      );
  } catch (err) {
    // never leave a sitting nobody can enter
    await Promise.all([
      ExamSittingModel.deleteOne({ _id: sitting._id }),
      SittingGrantModel.deleteMany({ sittingId: sitting._id }),
    ]);
    throw err;
  }
  return ok(
    { id: String(sitting._id), code: sitting.code, link: linkOf(sitting.code) },
    { status: 201, message: 'Đã tạo ca thi.' },
  );
}

export async function listSittings(req: Request, ctx: AuthCtx): Promise<Response> {
  const params = new URL(req.url).searchParams;
  const filter: Obj = { createdBy: ctx.user._id };
  if (params.has('classId')) {
    const classId = toObjectId(params.get('classId'));
    if (!classId) throw bad('classId không hợp lệ.', 'classId');
    filter.classIds = classId;
  }
  const now = new Date();
  const status = params.get('status');
  if (status !== null) {
    if (!STATUSES.includes(status))
      throw bad('status chỉ nhận not_started, open hoặc ended.', 'status');
    if (status === 'not_started') filter.openAt = { $gt: now };
    else if (status === 'open')
      Object.assign(filter, { openAt: { $lte: now }, closeAt: { $gt: now } });
    else filter.closeAt = { $lte: now };
  }
  const paging = parsePage(params, { defaultLimit: 20, maxLimit: 100 });
  const [items, total] = await Promise.all([
    ExamSittingModel.find(filter)
      .select('-questions')
      .sort({ createdAt: -1, _id: -1 })
      .skip(paging.skip)
      .limit(paging.limit)
      .lean(),
    ExamSittingModel.countDocuments(filter),
  ]);
  const ids = items.map((s) => s._id);
  const [granted, submitted] = await Promise.all([
    SittingGrantModel.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { sittingId: { $in: ids } } },
      { $group: { _id: '$sittingId', n: { $sum: 1 } } },
    ]),
    SittingSubmissionModel.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { sittingId: { $in: ids }, byTeacher: { $ne: true } } },
      { $group: { _id: '$sittingId', n: { $sum: 1 } } },
    ]),
  ]);
  const grantedBy = new Map(granted.map((r) => [String(r._id), r.n]));
  const submittedBy = new Map(submitted.map((r) => [String(r._id), r.n]));
  const dtos = items.map((s) =>
    toSummary(s as unknown as SittingLike, now, {
      grantedCount: grantedBy.get(String(s._id)) ?? 0,
      submittedCount: submittedBy.get(String(s._id)) ?? 0,
    }),
  );
  return ok(pageResult(dtos, total, paging));
}

export async function getSitting(_req: Request, ctx: AuthCtx): Promise<Response> {
  const sitting = await loadOwnedSitting(ctx);
  if (!sitting) throw notFound();
  return ok(await buildDetail(sitting));
}

export async function updateSitting(req: Request, ctx: AuthCtx): Promise<Response> {
  const sitting = await loadOwnedSitting(ctx);
  if (!sitting) throw notFound();
  const body = await bodyOf(req, TEMPLATE_JSON_MAX);
  const now = new Date();
  const changes: {
    title?: string;
    description?: string;
    openAt?: Date;
    closeAt?: Date;
    durationMinutes?: number;
    shuffleQuestions?: boolean;
    antiCheat?: boolean;
  } = {};
  if (body.title !== undefined) {
    changes.title = String(body.title ?? '').trim();
    if (!changes.title) throw bad('Tên ca thi không được để trống.');
    if (changes.title.length > LIMITS.TITLE_MAX)
      throw bad(`Tên ca thi tối đa ${LIMITS.TITLE_MAX} ký tự.`, 'title');
    if (
      titleKeyOf(changes.title) !== titleKeyOf(sitting.title) &&
      (await titleTaken(ctx.user._id, changes.title, sitting._id))
    )
      throw titleTakenError();
  }
  if (body.description !== undefined) {
    changes.description = String(body.description ?? '').trim();
    if (changes.description.length > LIMITS.DESCRIPTION_MAX)
      throw bad(`Mô tả ca thi tối đa ${LIMITS.DESCRIPTION_MAX} ký tự.`, 'description');
  }
  for (const key of ['openAt', 'closeAt'] as const) {
    if (body[key] === undefined) continue;
    const d = parseDate(body[key]);
    if (!d) throw bad('Giờ mở/đóng ca không hợp lệ.');
    changes[key] = d;
  }
  if ((changes.closeAt ?? sitting.closeAt) <= (changes.openAt ?? sitting.openAt))
    throw bad('Giờ đóng ca phải sau giờ mở ca.');
  if (body.durationMinutes !== undefined) {
    if (!isValidDuration(body.durationMinutes))
      throw bad('Thời gian làm bài phải là số nguyên từ 1 phút trở lên.');
    changes.durationMinutes = body.durationMinutes;
  }
  for (const key of ['shuffleQuestions', 'antiCheat'] as const) {
    if (body[key] === undefined) continue;
    if (typeof body[key] !== 'boolean') throw bad(`${key} phải là true hoặc false.`);
    changes[key] = body[key];
  }
  const publishedError = () =>
    new HttpError(
      'RESULTS_PUBLISHED',
      'Kết quả đang công bố. Hãy thu hồi công bố trước khi đổi giờ làm ca thi mở lại.',
    );
  // moving closeAt so the sitting reopens while results are published is refused
  if (
    sitting.resultsPublishedAt &&
    changes.closeAt &&
    changes.closeAt.getTime() + SUBMIT_GRACE_MS > now.getTime()
  )
    throw publishedError();
  if (changes.openAt) {
    const overlap = await findOverlapClassCode(sitting.classIds, changes.openAt, sitting._id);
    if (overlap !== null) throw overlapError(overlap);
  }
  let questions: ReturnType<typeof sanitizeQuestions>['questions'] | undefined;
  if (body.questions !== undefined) {
    const sanitized = sanitizeQuestions(body.questions);
    if (sanitized.errors.length > 0) throw bad(sanitized.errors[0]);
    questions = sanitized.questions;
    const afterTimes = {
      _id: sitting._id,
      openAt: changes.openAt ?? sitting.openAt,
      closeAt: changes.closeAt ?? sitting.closeAt,
    };
    // checked both before and after the time change: moving the times must not be a way around the lock
    if ((await getLock(sitting, now)).locked || (await getLock(afterTimes, now)).locked)
      throw new HttpError(
        'SITTING_LOCKED',
        'Ca đang mở và đã có bài nộp hoặc có học sinh đang làm bài nên không thể sửa câu hỏi.',
      );
  }
  if (changes.closeAt && changes.closeAt.getTime() + SUBMIT_GRACE_MS > now.getTime()) {
    // conditional write: a publish that landed after the read above wins
    const guarded = sitting.resultsPublishedAt
      ? { matchedCount: 0 }
      : await ExamSittingModel.updateOne(
          { _id: sitting._id, createdBy: ctx.user._id, resultsPublishedAt: null },
          { $set: { closeAt: changes.closeAt } },
        );
    if (guarded.matchedCount === 0) throw publishedError();
  }

  const scheduleChanged = body.closeAt !== undefined || body.durationMinutes !== undefined;
  const previousSignature = essaySignature(sitting.questions);
  sitting.set(changes);
  if (questions) sitting.set('questions', questions);
  await sitting.save(); // save() recomputes scoring and clears the sitting cache

  let affectedSessions = 0;
  if (scheduleChanged) {
    const durationMs = sitting.durationMinutes * 60000;
    const deadline = { $min: [{ $add: ['$startedAt', durationMs] }, sitting.closeAt] };
    const [shortened] = await SittingSessionModel.aggregate<{ n: number }>([
      { $match: { sittingId: sitting._id } },
      { $match: { $expr: { $gt: ['$deadlineAt', deadline] } } },
      { $count: 'n' },
    ]);
    affectedSessions = shortened?.n ?? 0;
    await SittingSessionModel.updateMany(
      { sittingId: sitting._id },
      [{ $set: { deadlineAt: deadline, expiresAt: { $add: [deadline, THIRTY_DAYS_MS] } } }],
      { updatePipeline: true },
    );
  }
  const updatedSubmissionsCount = questions
    ? await regradeSittingSubmissions(sitting, previousSignature)
    : 0;
  return ok(
    { ...(await buildDetail(sitting)), affectedSessions, updatedSubmissionsCount },
    { message: 'Đã cập nhật ca thi.' },
  );
}

export async function regenerateCode(_req: Request, ctx: AuthCtx): Promise<Response> {
  const sitting = await loadOwnedSitting(ctx);
  if (!sitting) throw notFound();
  const updated = await withUniqueSittingCode((code) =>
    ExamSittingModel.findOneAndUpdate(
      { _id: sitting._id, createdBy: ctx.user._id },
      { $set: { code } },
      { new: true },
    ).lean(),
  );
  if (!updated) throw notFound();
  return ok({ code: updated.code, link: linkOf(updated.code) }, { message: 'Đã đổi mã ca.' });
}

/**
 * Change the class set. classIds is written FIRST, grants are cleaned AFTER from the class set actually stored, so calling again completes it.
 * Students with no class left lose their grant and session, except those who already submitted.
 */
export async function updateClasses(req: Request, ctx: AuthCtx): Promise<Response> {
  const sitting = await loadOwnedSitting(ctx);
  if (!sitting) throw notFound();
  const classIds = parseIdList((await bodyOf(req)).classIds);
  if (!classIds || classIds.length === 0) throw invalidClasses();
  const current = new Set(sitting.classIds.map(String));
  const added = classIds.filter((id) => !current.has(String(id)));
  if (added.length > 0 && !(await areTeachableActiveClasses(ctx.user._id, added)))
    throw invalidClasses();
  if (added.length > 0) {
    const overlap = await findOverlapClassCode(added, sitting.openAt, sitting._id);
    if (overlap !== null) throw overlapError(overlap);
  }
  // optimistic lock on the class set that was read
  const written = await ExamSittingModel.updateOne(
    { _id: sitting._id, createdBy: ctx.user._id, classIds: sitting.classIds },
    { $set: { classIds } },
  );
  if (written.matchedCount === 0)
    throw new HttpError(
      'SITTING_CLASSES_CHANGED',
      'Tập lớp của ca vừa được thay đổi ở nơi khác, hãy tải lại và thử lại.',
    );

  for (const classId of added) {
    const memberIds = await ClassMemberModel.distinct('userId', approvedStudentFilter([classId]));
    await SittingGrantModel.updateMany(
      { sittingId: sitting._id, studentId: { $in: memberIds } },
      { $addToSet: { classIds: classId } },
    );
  }
  const stored =
    (await ExamSittingModel.findById(sitting._id).select('classIds').lean())?.classIds ?? classIds;
  await SittingGrantModel.updateMany(
    { sittingId: sitting._id, classIds: { $elemMatch: { $nin: stored } } },
    { $pull: { classIds: { $nin: stored } } },
  );
  const empty = (
    await SittingGrantModel.find({ sittingId: sitting._id, classIds: { $size: 0 } })
      .select('studentId')
      .lean()
  ).map((g) => g.studentId);
  const submitted = new Set(
    (
      await SittingSubmissionModel.distinct('studentId', {
        sittingId: sitting._id,
        studentId: { $in: empty },
      })
    ).map(String),
  );
  const removable = empty.filter((id) => !submitted.has(String(id)));
  const [grants, sessions] =
    removable.length === 0
      ? [{ deletedCount: 0 }, { deletedCount: 0 }]
      : await Promise.all([
          SittingGrantModel.deleteMany({
            sittingId: sitting._id,
            studentId: { $in: removable },
            classIds: { $size: 0 },
          }),
          SittingSessionModel.deleteMany({ sittingId: sitting._id, studentId: { $in: removable } }),
        ]);
  return ok(
    {
      classIds: classIds.map(String),
      addedClassIds: added.map(String),
      removedGrants: grants.deletedCount,
      removedSessions: sessions.deletedCount,
    },
    { message: 'Đã cập nhật tập lớp của ca.' },
  );
}

export async function deleteSitting(_req: Request, ctx: AuthCtx): Promise<Response> {
  const sitting = await loadOwnedSitting(ctx);
  if (!sitting) throw notFound();
  if (await hasSubmissions(sitting._id))
    throw new HttpError('SITTING_HAS_SUBMISSIONS', 'Ca thi đã có bài nộp nên không thể xóa.');
  const sittingId = sitting._id;
  await Promise.all([
    SittingGrantModel.deleteMany({ sittingId }),
    SittingSessionModel.deleteMany({ sittingId }),
    EssayUploadModel.deleteMany({ sittingId }),
    EssayMediaModel.deleteMany({ sittingId }),
  ]);
  await ExamSittingModel.deleteOne({ _id: sittingId, createdBy: ctx.user._id });
  return ok(null, { message: 'Đã xóa ca thi.' });
}

export async function listGrants(req: Request, ctx: AuthCtx): Promise<Response> {
  const sitting = await loadOwnedSitting(ctx);
  if (!sitting) throw notFound();
  const params = new URL(req.url).searchParams;
  const paging = parsePage(params, { defaultLimit: PAGE_SIZE, maxLimit: 100 });
  const studentIds = await SittingGrantModel.distinct('studentId', { sittingId: sitting._id });
  const { users, total } = await pageUsers(studentIds, params.get('q'), paging); // CURRENT names, one User.find per page
  const ids = users.map((u) => u._id);
  const live = await liveClassIds(sitting.classIds);
  const [grants, submitted, sessions, inClass, names] = await Promise.all([
    SittingGrantModel.find({ sittingId: sitting._id, studentId: { $in: ids } })
      .select('studentId classIds')
      .lean(),
    SittingSubmissionModel.distinct('studentId', {
      sittingId: sitting._id,
      studentId: { $in: ids },
    }),
    SittingSessionModel.distinct('studentId', { sittingId: sitting._id, studentId: { $in: ids } }),
    ClassMemberModel.distinct('userId', approvedStudentFilter(live, { userId: { $in: ids } })),
    classNameMap(sitting.classIds),
  ]);
  const grantOf = new Map(grants.map((g) => [String(g.studentId), g]));
  const submittedSet = new Set(submitted.map(String));
  const sessionSet = new Set(sessions.map(String));
  const inClassSet = new Set(inClass.map(String));
  const items = users.map((u) => {
    const key = String(u._id);
    const gClassIds = grantOf.get(key)?.classIds ?? [];
    return {
      studentId: key,
      fullName: u.fullName,
      classIds: gClassIds.map(String),
      classNames: gClassIds.map((id) => names.get(String(id))?.name ?? ''),
      submitted: submittedSet.has(key),
      hasSession: sessionSet.has(key),
      inClass: inClassSet.has(key),
    };
  });
  return ok(pageResult(items, total, paging));
}

export async function addGrants(req: Request, ctx: AuthCtx): Promise<Response> {
  const sitting = await loadOwnedSitting(ctx);
  if (!sitting) throw notFound();
  const live = await liveClassIds(sitting.classIds);
  const picked = await resolveStudents(await bodyOf(req), live);
  if (!picked) throw invalidStudents();
  const ids = [...picked.values()].map((p) => p.id);
  const existing = await SittingGrantModel.countDocuments({
    sittingId: sitting._id,
    studentId: { $in: ids },
  });
  const ops = [...picked.values()].map(({ id, classIds: studentClassIds }) => ({
    updateOne: {
      filter: { sittingId: sitting._id, studentId: id },
      update: {
        $setOnInsert: { grantedBy: ctx.user._id, grantedAt: new Date() },
        $addToSet: { classIds: { $each: studentClassIds } },
      },
      upsert: true,
    },
  }));
  try {
    await SittingGrantModel.bulkWrite(ops, { ordered: false });
  } catch (err) {
    const writeErrors =
      (err as { writeErrors?: { code?: number; err?: { code?: number } }[] }).writeErrors ?? [];
    if (!(writeErrors.length > 0 && writeErrors.every((e) => (e.code ?? e.err?.code) === 11000)))
      throw err;
    await SittingGrantModel.bulkWrite(ops, { ordered: false }); // two parallel upserts: the second now matches
  }
  return ok(
    { granted: ids.length - existing, alreadyGranted: existing },
    { message: 'Đã cấp quyền vào ca.' },
  );
}

export async function revokeGrants(req: Request, ctx: AuthCtx): Promise<Response> {
  const sitting = await loadOwnedSitting(ctx);
  if (!sitting) throw notFound();
  const studentIds = parseIdList((await bodyOf(req)).studentIds);
  if (!studentIds || studentIds.length === 0) throw invalidStudents();
  const submitted = new Set(
    (
      await SittingSubmissionModel.distinct('studentId', {
        sittingId: sitting._id,
        studentId: { $in: studentIds },
      })
    ).map(String),
  );
  const revocable = studentIds.filter((id) => !submitted.has(String(id)));
  const [grants, sessions] = await Promise.all([
    SittingGrantModel.deleteMany({ sittingId: sitting._id, studentId: { $in: revocable } }),
    SittingSessionModel.deleteMany({ sittingId: sitting._id, studentId: { $in: revocable } }), // a half-done session goes: a later submit gets NOT_GRANTED
  ]);
  return ok(
    {
      revoked: grants.deletedCount,
      removedSessions: sessions.deletedCount,
      skippedSubmitted: submitted.size,
    },
    { message: 'Đã thu hồi quyền vào ca.' },
  );
}

export { approvedStudentFilter, classNameMap, liveClassIds, pageUsers };
