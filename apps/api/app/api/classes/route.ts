// Created by Haihs on 12/11/2026
// POST /api/classes (create; creator becomes approved teacher) and GET /api/classes (my classes as teacher). Source: classController.js createClass/listClasses.
import type { ClassBody } from '@doc-to-exam/contract';
import { ok, pageResult, parsePage } from '../../../src/lib/apiResponse';
import { withPermission } from '../../../src/lib/auth';
import { toClassDto, mapCodeTaken } from '../../../src/lib/classDto';
import { HttpError, readJson, withErrors } from '../../../src/lib/handler';
import { escapeRegExp } from '../../../src/lib/textUtils';
import { ClassModel } from '../../../src/models/Class';
import { ClassMemberModel } from '../../../src/models/ClassMember';
import { countByRole } from '../../../src/services/classMembers';

export const runtime = 'nodejs';

const VIEWS = ['active', 'graduated', 'deleted', 'all'];
// aggregate ignores select:false, so whitelist fields (invite tokens must never be listed)
const LIST_FIELDS = { name: 1, code: 1, startYear: 1, endYear: 1, status: 1, deletedAt: 1 };

export const POST = withErrors(
  withPermission('class:create', async (req, ctx) => {
    const raw = await readJson(req, 16_384);
    const { name, code, startYear, endYear } = (
      raw && typeof raw === 'object' ? raw : {}
    ) as Partial<ClassBody>;
    const cls = await mapCodeTaken(() =>
      ClassModel.create({ name, code, startYear, endYear, createdBy: ctx.user._id }),
    );
    try {
      await ClassMemberModel.create({
        classId: cls._id,
        userId: ctx.user._id,
        memberRole: 'teacher',
        status: 'approved',
        source: 'creator',
        approvedAt: cls.createdAt,
        approvedBy: ctx.user._id,
      });
    } catch (err) {
      await ClassModel.deleteOne({ _id: cls._id }); // no orphan class nobody can manage
      throw err;
    }
    return ok(toClassDto(cls, { studentCount: 0, teacherCount: 1 }), { status: 201 });
  }),
);

export const GET = withErrors(
  withPermission('class:list', async (req, ctx) => {
    const params = new URL(req.url).searchParams;
    const view = params.get('view') ?? 'active';
    if (!VIEWS.includes(view))
      throw new HttpError('VALIDATION', 'view phải là active, graduated, deleted hoặc all.', {
        field: 'view',
      });
    const paging = parsePage(params, { defaultLimit: 10, maxLimit: 50 });

    const mine = await ClassMemberModel.find({ userId: ctx.user._id, memberRole: 'teacher' })
      .select('classId status')
      .lean();
    const idsOf = (s: string) => mine.filter((m) => m.status === s).map((m) => m.classId);
    const approvedIds = idsOf('approved');
    const pendingIds = idsOf('pending');
    const pendingSet = new Set(pendingIds.map(String));

    // Deleted classes only for approved teachers; classes I am pending for show only while not deleted.
    const base =
      view === 'deleted'
        ? { _id: { $in: approvedIds }, deletedAt: { $ne: null } }
        : { $or: [{ _id: { $in: approvedIds } }, { _id: { $in: pendingIds }, deletedAt: null }] };
    const q = (params.get('q') ?? '').trim().slice(0, 50);
    const conds: object[] = [base];
    if (view === 'active' || view === 'graduated') conds.push({ status: view });
    if (q) {
      const re = new RegExp(escapeRegExp(q), 'i');
      conds.push({ $or: [{ name: re }, { code: re }] });
    }
    const agg = ClassModel.aggregate<{
      items: Array<Record<string, unknown>>;
      total: Array<{ n: number }>;
    }>([
      { $match: conds.length > 1 ? { $and: conds } : base },
      { $project: LIST_FIELDS },
      {
        $addFields: {
          rank: {
            $cond: [
              { $ne: ['$deletedAt', null] },
              2,
              { $cond: [{ $eq: ['$status', 'graduated'] }, 1, 0] },
            ],
          },
        },
      },
      { $sort: { startYear: -1, endYear: -1, rank: 1, name: 1, _id: 1 } },
      {
        $facet: {
          items: [{ $skip: paging.skip }, { $limit: paging.limit }],
          total: [{ $count: 'n' }],
        },
      },
    ]);
    if (view === 'deleted' || view === 'all') agg.option({ withDeleted: true });
    const [{ items, total }] = await agg;

    const counts = await countByRole(
      items.filter((c) => !pendingSet.has(String(c._id))).map((c) => c._id as never),
    );
    const dtos = items.map((c) => {
      const dto = toClassDto(c as never);
      if (pendingSet.has(String(c._id)))
        return { ...dto, membershipStatus: 'pending' as const, studentCount: 0, teacherCount: 0 };
      const n = counts.get(String(c._id)) ?? {};
      return {
        ...dto,
        membershipStatus: 'approved' as const,
        studentCount: n.student ?? 0,
        teacherCount: n.teacher ?? 0,
      };
    });
    return ok(pageResult(dtos, total[0]?.n ?? 0, paging));
  }),
);
