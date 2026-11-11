// Created by Haihs on 12/11/2026
// withClassPermission: class-scoped route guard (non-member -> 404, missing permission in class -> 403). Port of requireClassPermission.
import { fail } from './apiResponse';
import { withAuth, type AuthCtx, type UserDoc } from './auth';
import type { Handler } from './handler';
import { hasPermission, PERMISSIONS } from './rbac';
import { ClassMemberModel } from '../models/ClassMember';
import { ClassModel } from '../models/Class';

type ClassDoc = NonNullable<Awaited<ReturnType<typeof ClassModel.findOne>>>;
type Membership = NonNullable<Awaited<ReturnType<typeof ClassMemberModel.findOne>>>;
export interface ClassCtx {
  user: UserDoc;
  userId: string;
  classDoc: ClassDoc;
  membership: Membership;
  params: Record<string, string>;
}
export type ClassHandler = (req: Request, ctx: ClassCtx) => Promise<Response>;

const ID_RE = /^[0-9a-f]{24}$/i;
const KNOWN = new Set(Object.values(PERMISSIONS).flat());
// Same answer for every "you may not know this class exists" reason.
const notFound = () => fail('NOT_FOUND', 'Không tìm thấy lớp.');

/** Includes authentication (do not also wrap in withAuth). Route param `id` is the class id. */
export function withClassPermission(
  classPerm: string,
  h: ClassHandler,
  opts: { withDeleted?: boolean } = {},
): Handler {
  if (!KNOWN.has(classPerm)) throw new Error(`Unknown permission: ${classPerm}`);
  return withAuth(async (req, ctx: AuthCtx) => {
    const params = ((await ctx.params) ?? {}) as Record<string, string>;
    const id = params.id;
    if (typeof id !== 'string' || !ID_RE.test(id)) return notFound(); // before any DB call
    const classDoc = await ClassModel.findOne({ _id: id }).setOptions({
      withDeleted: opts.withDeleted === true,
    });
    if (!classDoc) return notFound();
    const membership = await ClassMemberModel.findOne({
      classId: classDoc._id,
      userId: ctx.user._id,
      status: 'approved',
    });
    if (!membership) return notFound();
    if (!(await hasPermission(membership.memberRole as never, classPerm)))
      return fail('FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.');
    return h(req, { user: ctx.user, userId: ctx.userId, classDoc, membership, params });
  });
}
