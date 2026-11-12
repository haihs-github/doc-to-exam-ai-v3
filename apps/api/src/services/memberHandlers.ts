// Created by Haihs on 12/11/2026
// Class-member handler factories shared by the student and teacher routes. Source: server/controllers/memberController.js.
import type { Types } from 'mongoose';
import { ok, pageResult, parsePage, toObjectId } from '../lib/apiResponse';
import type { ClassHandler } from '../lib/classAuth';
import { HttpError, readJson } from '../lib/handler';
import { parsePhone } from '../lib/authValidation';
import { escapeRegExp, toSearchKey } from '../lib/textUtils';
import { ClassMemberModel } from '../models/ClassMember';
import { UserModel } from '../models/User';
import { guardedDeleteMember } from './classMembers';

export type MemberRole = 'student' | 'teacher';
const STATUSES = ['pending', 'approved'] as const;
const NAME_SEARCH_MIN = 3;
const NAME_SEARCH_MAX = 50;
const PHONE_SEARCH_MIN = 3;
const PHONE_QUERY_RE = /^[\d+\s]+$/;

const NOT_FOUND = {
  student: ['STUDENT_NOT_FOUND', 'Không tìm thấy học sinh.'],
  teacher: ['TEACHER_NOT_FOUND', 'Không tìm thấy giáo viên.'],
} as const;
export const memberNotFound = (role: MemberRole) =>
  new HttpError(NOT_FOUND[role][0], NOT_FOUND[role][1]);

/** A graduated class takes no new members by any route. */
export function assertAccepting(classDoc: { status: string }): void {
  if (classDoc.status !== 'active')
    throw new HttpError(
      'CLASS_NOT_ACCEPTING',
      'Lớp đã tốt nghiệp, hãy chuyển về Đang học để thêm thành viên.',
    );
}

const statusOr = (raw: string | null, fallback: 'pending' | 'approved') =>
  (STATUSES as readonly string[]).includes(raw ?? '') ? (raw as 'pending' | 'approved') : fallback;

/** Adds the member as approved (pending -> approved); idempotent and safe under a race (E11000 retried once). */
export async function addApproved(
  classId: Types.ObjectId,
  actorId: Types.ObjectId,
  userId: Types.ObjectId,
  memberRole: MemberRole,
): Promise<void> {
  const now = new Date();
  const key = { classId, userId };
  const promoted = await ClassMemberModel.updateOne(
    { ...key, status: 'pending' },
    { $set: { status: 'approved', approvedAt: now, approvedBy: actorId } },
  );
  if (promoted.matchedCount) return;
  const upsert = () =>
    ClassMemberModel.updateOne(
      key,
      {
        $setOnInsert: {
          memberRole,
          status: 'approved',
          source: 'member_add',
          addedBy: actorId,
          requestedAt: now,
          approvedAt: now,
          approvedBy: actorId,
        },
      },
      { upsert: true },
    );
  try {
    await upsert();
  } catch (err) {
    if ((err as { code?: unknown }).code !== 11000) throw err;
    await upsert();
  }
}

export const listStudents: ClassHandler = async (req, { classDoc }) => {
  const params = new URL(req.url).searchParams;
  const paging = parsePage(params, { defaultLimit: 50, maxLimit: 100 });
  const q = toSearchKey(params.get('q') ?? '').slice(0, NAME_SEARCH_MAX);
  const studentIdRaw = params.get('studentId');
  const studentId = studentIdRaw === null ? null : toObjectId(studentIdRaw);
  if (studentIdRaw !== null && !studentId)
    throw new HttpError('VALIDATION', 'studentId không hợp lệ.', { field: 'studentId' });
  const [r] = await ClassMemberModel.aggregate<{
    items: Record<string, unknown>[];
    total: { n: number }[];
  }>([
    // narrow by class BEFORE the $lookup
    {
      $match: {
        classId: classDoc._id,
        memberRole: 'student',
        status: statusOr(params.get('status'), 'approved'),
        ...(studentId ? { userId: studentId } : {}),
      },
    },
    {
      $lookup: {
        from: UserModel.collection.name,
        localField: 'userId',
        foreignField: '_id',
        pipeline: [{ $project: { fullName: 1, phoneNumber: 1, nameSearch: 1 } }],
        as: 'u',
      },
    },
    { $unwind: '$u' },
    ...(q ? [{ $match: { 'u.nameSearch': new RegExp(escapeRegExp(q)) } }] : []),
    { $sort: { 'u.nameSearch': 1, userId: 1 } },
    {
      $facet: {
        items: [
          { $skip: paging.skip },
          { $limit: paging.limit },
          {
            $project: {
              _id: 0,
              userId: { $toString: '$userId' },
              fullName: '$u.fullName',
              phoneNumber: '$u.phoneNumber',
              status: 1,
              requestedAt: 1,
              approvedAt: 1,
            },
          },
        ],
        total: [{ $count: 'n' }],
      },
    },
  ]);
  return ok(pageResult(r?.items ?? [], r?.total[0]?.n ?? 0, paging));
};

/** Whole-system search, but ONLY accounts of `role`. Name (>=3 chars) or phone digits (>=3). */
export const searchUsers =
  (role: MemberRole): ClassHandler =>
  async (req, { classDoc }) => {
    const params = new URL(req.url).searchParams;
    const raw = (params.get('q') ?? '').trim();
    const digits = raw.replace(/\D/g, '');
    const byPhone = raw !== '' && PHONE_QUERY_RE.test(raw);
    const key = toSearchKey(raw);
    if (byPhone ? digits.length < PHONE_SEARCH_MIN : key.length < NAME_SEARCH_MIN)
      throw new HttpError(
        'VALIDATION',
        byPhone
          ? `Nhập ít nhất ${PHONE_SEARCH_MIN} chữ số để tìm theo số điện thoại.`
          : `Nhập ít nhất ${NAME_SEARCH_MIN} ký tự để tìm.`,
        { field: 'q' },
      );
    if (key.length > NAME_SEARCH_MAX)
      throw new HttpError('VALIDATION', `Chuỗi tìm tối đa ${NAME_SEARCH_MAX} ký tự.`, {
        field: 'q',
      });
    const paging = parsePage(params, { defaultLimit: 20, maxLimit: 50 });
    // shortcut: "contains" regex cannot use an index (school-size data, limiters in front); switch to an anchored prefix if slow
    const filter = {
      role,
      ...(byPhone
        ? { phoneNumber: new RegExp(escapeRegExp(digits)) }
        : { nameSearch: new RegExp(escapeRegExp(key)) }),
    };
    const [total, users] = await Promise.all([
      UserModel.countDocuments(filter),
      UserModel.find(filter)
        .select('fullName phoneNumber nameSearch')
        .sort({ nameSearch: 1, _id: 1 })
        .skip(paging.skip)
        .limit(paging.limit)
        .lean(),
    ]);
    const joined = await ClassMemberModel.find({
      classId: classDoc._id,
      status: 'approved',
      userId: { $in: users.map((u) => u._id) },
    })
      .select('userId')
      .lean();
    const joinedSet = new Set(joined.map((m) => String(m.userId)));
    const items = users.map((u) => ({
      userId: String(u._id),
      fullName: u.fullName,
      phoneNumber: u.phoneNumber,
      alreadyMember: joinedSet.has(String(u._id)),
    }));
    return ok({ ...pageResult(items, total, paging), hasMore: paging.page * paging.limit < total });
  };

/** Looks the account up by {studentId|teacherId} or {phoneNumber}; unknown phone and wrong role give the same 404. */
export const addByLookup =
  (role: MemberRole): ClassHandler =>
  async (req, { classDoc, user }) => {
    assertAccepting(classDoc);
    const raw = await readJson(req, 4096);
    const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const idField = role === 'student' ? 'studentId' : 'teacherId';
    let found;
    if (body[idField] !== undefined) {
      const id = toObjectId(body[idField]);
      if (!id) throw new HttpError('VALIDATION', `${idField} không hợp lệ.`, { field: idField });
      found = await UserModel.findOne({ _id: id, role }).select('fullName phoneNumber').lean();
    } else {
      const phone = parsePhone(body.phoneNumber);
      found = await UserModel.findOne({ phoneNumber: phone, role })
        .select('fullName phoneNumber')
        .lean();
    }
    if (!found) throw memberNotFound(role);
    await addApproved(classDoc._id, user._id, found._id, role);
    return ok(
      {
        userId: String(found._id),
        fullName: found.fullName,
        phoneNumber: found.phoneNumber,
        status: 'approved',
      },
      { status: 201 },
    );
  };

export const approveOne =
  (role: MemberRole): ClassHandler =>
  async (_req, { classDoc, user, params }) => {
    assertAccepting(classDoc);
    const userId = toObjectId(params.userId);
    if (!userId) throw memberNotFound(role);
    const key = { classId: classDoc._id, userId, memberRole: role };
    const done = await ClassMemberModel.updateOne(
      { ...key, status: 'pending' },
      { $set: { status: 'approved', approvedAt: new Date(), approvedBy: user._id } },
    );
    if (!done.modifiedCount && !(await ClassMemberModel.exists({ ...key, status: 'approved' })))
      throw memberNotFound(role);
    return ok(null, { message: 'Đã duyệt.' });
  };

/** ONE updateMany, independent of the page being viewed. */
export const approveAllStudents: ClassHandler = async (_req, { classDoc, user }) => {
  assertAccepting(classDoc);
  const done = await ClassMemberModel.updateMany(
    { classId: classDoc._id, memberRole: 'student', status: 'pending' },
    { $set: { status: 'approved', approvedAt: new Date(), approvedBy: user._id } },
  );
  return ok({ approved: done.modifiedCount });
};

export const rejectAllStudents: ClassHandler = async (_req, { classDoc }) => {
  const done = await ClassMemberModel.deleteMany({
    classId: classDoc._id,
    memberRole: 'student',
    status: 'pending',
  });
  return ok({ rejected: done.deletedCount });
};

export const removeMember =
  (role: MemberRole): ClassHandler =>
  async (_req, { classDoc, user, params }) => {
    const userId = toObjectId(params.userId);
    if (role === 'teacher' && userId && String(userId) === String(user._id))
      throw new HttpError('VALIDATION', 'Muốn rời lớp hãy dùng chức năng Rời lớp.');
    const member = userId
      ? await ClassMemberModel.findOne({ classId: classDoc._id, userId, memberRole: role })
      : null;
    if (!member) throw memberNotFound(role);
    await guardedDeleteMember(classDoc._id, member.userId); // throws LAST_TEACHER
    return ok(null, { message: 'Đã gỡ.' });
  };
