// Created by Haihs on 12/11/2026
// Exam template use cases: owner-scoped CRUD, trash, restore, purge, duplicate. Port of server/controllers/templateController.js (non-parse part).
import type { TemplateDetail, TemplateSummary } from '@doc-to-exam/contract';
import mongoose, { type Types } from 'mongoose';
import { ok, pageResult, parsePage, toObjectId } from '../lib/apiResponse';
import type { AuthCtx } from '../lib/auth';
import { stripCopySuffix, buildCopyTitle } from '../lib/examCopyName';
import { sanitizeQuestions } from '../lib/examValidation';
import { HttpError, readJson } from '../lib/handler';
import { escapeRegExp, LIMITS, normalizeString } from '../lib/textUtils';
import { ExamTemplateModel, type IExamTemplate } from '../models/ExamTemplate';

const MAX_DUPLICATE_ATTEMPTS = 20;
const DAY_MS = 24 * 60 * 60 * 1000;
export const TEMPLATE_JSON_MAX = 5 * 1024 * 1024; // sanitised questions can be large (inventory 1.2)

type Doc = Pick<
  IExamTemplate,
  'title' | 'description' | 'totalQuestions' | 'scoring' | 'createdAt' | 'updatedAt'
> & { _id: unknown; deletedAt?: Date | null; purgeAt?: Date | null };

// TODO(api): M4 — đếm bằng ExamSittingModel khi model ca thi có
/** Sittings per template of ONE owner, from the raw collection (the model arrives with M4). */
export async function sittingCounts(
  owner: Types.ObjectId,
  templateIds: unknown[],
): Promise<Map<string, number>> {
  if (templateIds.length === 0) return new Map();
  const rows = await mongoose.connection
    .collection('examsittings')
    .aggregate<{ _id: unknown; n: number }>([
      { $match: { createdBy: owner, templateId: { $in: templateIds } } },
      { $group: { _id: '$templateId', n: { $sum: 1 } } },
    ])
    .toArray();
  return new Map(rows.map((r) => [String(r._id), r.n]));
}

export const toSummary = (t: Doc, sittingCount: number): TemplateSummary => ({
  id: String(t._id),
  title: t.title,
  description: t.description,
  totalQuestions: t.totalQuestions,
  scoring: t.scoring,
  createdAt: t.createdAt.toISOString(),
  updatedAt: t.updatedAt.toISOString(),
  sittingCount,
});
const toDetail = (t: Doc & { questions: unknown[] }, sittingCount: number): TemplateDetail =>
  ({ ...toSummary(t, sittingCount), questions: t.questions }) as TemplateDetail;

const notFound = () => new HttpError('NOT_FOUND', 'Không tìm thấy đề mẫu.');
const trashNotFound = () => new HttpError('NOT_FOUND', 'Không tìm thấy đề mẫu trong mục Đã xoá.');
const idOf = async (ctx: AuthCtx) => toObjectId(((await ctx.params) ?? {}).id);
const bodyOf = async (req: Request): Promise<Record<string, unknown>> => {
  const raw = await readJson(req, TEMPLATE_JSON_MAX);
  return (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<
    string,
    unknown
  >;
};
const bad = (message: string, field?: string) =>
  new HttpError('VALIDATION', message, field ? { field } : undefined);
const titleTooLong = () => bad(`Tên đề mẫu tối đa ${LIMITS.TITLE_MAX} ký tự.`, 'title');
const descriptionTooLong = () =>
  bad(`Mô tả tối đa ${LIMITS.DESCRIPTION_MAX} ký tự.`, 'description');

/** E11000 on a name: a live template holds it, or (old index) a trashed one does. */
async function titleConflict(owner: Types.ObjectId, title: string): Promise<HttpError> {
  const live = await ExamTemplateModel.exists({
    createdBy: owner,
    titleKey: normalizeString(title),
  }); // plugin hides deleted
  return new HttpError(
    'TEMPLATE_TITLE_TAKEN',
    live
      ? `Tên đề mẫu "${title}" đã tồn tại. Vui lòng chọn tên khác!`
      : `Tên "${title}" đang bị một đề trong mục Đã xoá giữ chỗ. Hãy xóa vĩnh viễn đề đó, chọn tên khác, hoặc chạy bước di chuyển chỉ mục.`,
    { field: 'title' },
  );
}
const isDup = (err: unknown) => (err as { code?: unknown } | null)?.code === 11000;

/** By id AND owner; malformed id, missing and someone else's all give the same null (404). */
async function loadOwned(ctx: AuthCtx) {
  const id = await idOf(ctx);
  return id ? ExamTemplateModel.findOne({ _id: id, createdBy: ctx.user._id }) : null;
}
const countSittingsOf = async (t: { _id: unknown }, owner: Types.ObjectId) =>
  (await sittingCounts(owner, [t._id])).get(String(t._id)) ?? 0;

export async function createTemplate(req: Request, ctx: AuthCtx): Promise<Response> {
  const body = await bodyOf(req);
  const title = String(body.title ?? '').trim();
  if (!title) throw bad('Tên đề mẫu không được để trống.');
  const description = String(body.description ?? '').trim();
  if (title.length > LIMITS.TITLE_MAX) throw titleTooLong();
  if (description.length > LIMITS.DESCRIPTION_MAX) throw descriptionTooLong();
  const { questions, errors } = sanitizeQuestions(body.questions);
  if (errors.length > 0) throw bad(errors[0]);
  const template = new ExamTemplateModel({
    createdBy: ctx.user._id,
    title,
    description,
    questions,
  });
  try {
    await template.save();
  } catch (err) {
    if (isDup(err)) throw await titleConflict(ctx.user._id, title);
    throw err;
  }
  return ok(toSummary(template, 0), { status: 201, message: 'Đã lưu đề mẫu.' });
}

export async function listTemplates(req: Request, ctx: AuthCtx): Promise<Response> {
  const params = new URL(req.url).searchParams;
  const view = params.get('view') ?? 'active';
  if (view !== 'active' && view !== 'deleted')
    throw bad('view chỉ nhận active hoặc deleted.', 'view');
  const deletedView = view === 'deleted';
  const now = new Date();
  const paging = parsePage(params, { defaultLimit: 20, maxLimit: 100 });
  const filter: Record<string, unknown> = { createdBy: ctx.user._id };
  // trash tab: purgeAt > now because Mongo's TTL monitor deletes minutes late
  if (deletedView) Object.assign(filter, { deletedAt: { $ne: null }, purgeAt: { $gt: now } });
  const q = normalizeString(params.get('q') ?? '');
  if (q) filter.titleKey = { $regex: escapeRegExp(q) };
  const sortBy = deletedView ? { deletedAt: -1, _id: -1 } : { createdAt: -1, _id: -1 };
  const [items, total] = await Promise.all([
    ExamTemplateModel.find(filter)
      .setOptions({ withDeleted: deletedView })
      .select('-questions')
      .sort(sortBy as never)
      .skip(paging.skip)
      .limit(paging.limit)
      .lean(),
    ExamTemplateModel.countDocuments(filter).setOptions({ withDeleted: deletedView }),
  ]);
  const counts = await sittingCounts(
    ctx.user._id,
    items.map((t) => t._id),
  );
  const dtos = items.map((t) => {
    const row = toSummary(t, counts.get(String(t._id)) ?? 0);
    return deletedView
      ? {
          ...row,
          deletedAt: t.deletedAt?.toISOString(),
          purgeAt: t.purgeAt?.toISOString(),
          daysLeft: Math.max(0, Math.ceil(((t.purgeAt?.getTime() ?? 0) - now.getTime()) / DAY_MS)),
        }
      : row;
  });
  return ok(pageResult(dtos, total, paging));
}

export async function getTemplate(_req: Request, ctx: AuthCtx): Promise<Response> {
  const t = await loadOwned(ctx);
  if (!t) throw notFound();
  return ok(toDetail(t, await countSittingsOf(t, ctx.user._id)));
}

export async function updateTemplate(req: Request, ctx: AuthCtx): Promise<Response> {
  const t = await loadOwned(ctx);
  if (!t) throw notFound();
  const body = await bodyOf(req);
  if (body.title !== undefined) {
    const title = String(body.title ?? '').trim();
    if (!title) throw bad('Tên đề mẫu không được để trống.');
    if (title.length > LIMITS.TITLE_MAX) throw titleTooLong();
    t.title = title;
  }
  if (body.description !== undefined) {
    const description = String(body.description ?? '').trim();
    if (description.length > LIMITS.DESCRIPTION_MAX) throw descriptionTooLong(); // old long data stays editable elsewhere
    t.description = description;
  }
  if (body.questions !== undefined) {
    const { questions, errors } = sanitizeQuestions(body.questions);
    if (errors.length > 0) throw bad(errors[0]);
    t.set('questions', questions);
  }
  try {
    await t.save(); // save() recomputes titleKey and scoring
  } catch (err) {
    if (isDup(err)) throw await titleConflict(ctx.user._id, t.title);
    throw err;
  }
  return ok(toDetail(t, await countSittingsOf(t, ctx.user._id)), {
    message: 'Đã cập nhật đề mẫu.',
  });
}

export async function deleteTemplate(_req: Request, ctx: AuthCtx): Promise<Response> {
  const id = await idOf(ctx);
  const now = new Date();
  const result = id ? await ExamTemplateModel.softDeleteOwned(id, ctx.user._id, now) : null;
  if (!id || !result || result.matchedCount === 0) throw notFound();
  const row = await ExamTemplateModel.findOne({ _id: id, createdBy: ctx.user._id })
    .setOptions({ withDeleted: true })
    .select('purgeAt')
    .lean(); // null when purged in between
  const sittingCount = await countSittingsOf({ _id: id }, ctx.user._id); // sittings hold their own question copies
  return ok(
    { sittingCount, deletedAt: now.toISOString(), purgeAt: row?.purgeAt?.toISOString() ?? null },
    { message: 'Đã chuyển vào mục Đã xoá, tự xóa vĩnh viễn sau 30 ngày.' },
  );
}

export async function restoreTemplate(req: Request, ctx: AuthCtx): Promise<Response> {
  const id = await idOf(ctx);
  const body = req.body ? await bodyOf(req) : {};
  let title: string | undefined;
  if (body.title !== undefined) {
    title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) throw bad('Tên đề mẫu không được để trống.');
    if (title.length > LIMITS.TITLE_MAX) throw titleTooLong(); // restoreOwned skips the validators
  }
  if (!id) throw trashNotFound();
  let result;
  try {
    result = await ExamTemplateModel.restoreOwned(id, ctx.user._id, { title });
  } catch (err) {
    if (!isDup(err)) throw err;
    const held =
      title ??
      (
        await ExamTemplateModel.findOne({ _id: id, createdBy: ctx.user._id })
          .setOptions({ withDeleted: true })
          .select('title')
          .lean()
      )?.title;
    throw new HttpError(
      'TEMPLATE_TITLE_TAKEN',
      `Tên "${held}" đã được đề mẫu khác dùng. Hãy nhập tên mới để khôi phục, hoặc đổi tên đề kia.`,
      { field: 'title' },
    );
  }
  if (result.matchedCount === 0) throw trashNotFound(); // missing / not owner / not deleted / past purgeAt
  const t = await ExamTemplateModel.findOne({ _id: id, createdBy: ctx.user._id })
    .select('-questions')
    .lean();
  if (!t) throw trashNotFound(); // trashed again or purged by a concurrent request: 404 instead of a TypeError
  return ok(toSummary(t, await countSittingsOf(t, ctx.user._id)), {
    message: 'Đã khôi phục đề mẫu.',
  });
}

export async function purgeTemplate(_req: Request, ctx: AuthCtx): Promise<Response> {
  const id = await idOf(ctx);
  if (!id) throw notFound();
  // the plugin does NOT filter deleteOne, so the trash condition is explicit: a live template is never purged
  const r = await ExamTemplateModel.deleteOne({
    _id: id,
    createdBy: ctx.user._id,
    deletedAt: { $ne: null },
  });
  if (r.deletedCount === 1) return ok(null, { message: 'Đã xóa vĩnh viễn đề mẫu.' });
  if (
    await ExamTemplateModel.exists({ _id: id, createdBy: ctx.user._id }).setOptions({
      withDeleted: true,
    })
  )
    throw new HttpError('TEMPLATE_NOT_IN_TRASH', 'Chỉ xóa vĩnh viễn được đề đang ở mục Đã xoá.');
  throw notFound();
}

export async function duplicateTemplate(_req: Request, ctx: AuthCtx): Promise<Response> {
  const source = await loadOwned(ctx);
  if (!source) throw notFound();
  const plain = source.toObject() as unknown as { description: string; questions: unknown[] };
  const baseTitle = stripCopySuffix(source.title);
  let copyNumber = 1;
  for (let attempt = 0; attempt < MAX_DUPLICATE_ATTEMPTS; attempt += 1) {
    let title = buildCopyTitle(baseTitle, copyNumber);
    while (
      await ExamTemplateModel.exists({ createdBy: ctx.user._id, titleKey: normalizeString(title) })
    ) {
      copyNumber += 1;
      title = buildCopyTitle(baseTitle, copyNumber);
    }
    const copy = new ExamTemplateModel({
      createdBy: ctx.user._id,
      title,
      description: plain.description,
      questions: structuredClone(plain.questions),
    });
    try {
      await copy.save();
    } catch (err) {
      if (isDup(err)) {
        copyNumber += 1; // a concurrent request just took this name
        continue;
      }
      throw err;
    }
    return ok(toSummary(copy, 0), { status: 201, message: `Đã tạo bản sao "${copy.title}".` });
  }
  throw new HttpError(
    'TEMPLATE_TITLE_TAKEN',
    'Không thể tạo bản sao lúc này vì nhiều yêu cầu trùng tên cùng lúc. Vui lòng thử lại sau ít giây.',
  );
}
