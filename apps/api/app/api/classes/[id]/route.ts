// Created by Haihs on 12/11/2026
// GET/PATCH/DELETE /api/classes/:id. Source: classController.js getClass/updateClass/deleteClass.
import { ok } from '../../../../src/lib/apiResponse';
import { toClassDto, mapCodeTaken } from '../../../../src/lib/classDto';
import { withClassPermission } from '../../../../src/lib/classAuth';
import { HttpError, readJson, withErrors } from '../../../../src/lib/handler';
import { ClassMemberModel } from '../../../../src/models/ClassMember';
import { UserModel } from '../../../../src/models/User';
import { countByRole } from '../../../../src/services/classMembers';

export const runtime = 'nodejs';

const EDITABLE = ['name', 'code', 'startYear', 'endYear', 'status'] as const; // createdBy/invite/... are never mass-assigned

export const GET = withErrors(
  withClassPermission('class:read', async (_req, { classDoc }) => {
    const [members, counts] = await Promise.all([
      ClassMemberModel.find({ classId: classDoc._id, memberRole: 'teacher', status: 'approved' })
        .select('userId')
        .lean(),
      countByRole([classDoc._id], 'all'),
    ]);
    const n = counts.get(String(classDoc._id)) ?? {};
    const teachers = await UserModel.find({ _id: { $in: members.map((m) => m.userId) } })
      .select('fullName phoneNumber nameSearch')
      .sort({ nameSearch: 1 })
      .lean();
    return ok(
      toClassDto(classDoc, {
        studentCount: n.student ?? 0,
        teacherCount: n.teacher ?? 0,
        pendingStudentCount: n.pendingStudent ?? 0,
        pendingTeacherCount: n.pendingTeacher ?? 0,
        teachers: teachers.map((t) => ({
          id: String(t._id),
          fullName: t.fullName,
          phoneNumber: t.phoneNumber,
        })),
      }),
    );
  }),
);

export const PATCH = withErrors(
  withClassPermission('class:update', async (req, { classDoc }) => {
    const raw = await readJson(req, 16_384);
    const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const fields = EDITABLE.filter((k) => body[k] !== undefined);
    if (!fields.length) throw new HttpError('VALIDATION', 'Không có trường nào để cập nhật.');
    for (const k of fields) classDoc.set(k, body[k]);
    await mapCodeTaken(() => classDoc.save()); // save() runs validation, upper-casing and codeKey derivation
    return ok(toClassDto(classDoc));
  }),
);

export const DELETE = withErrors(
  withClassPermission('class:delete', async (_req, { classDoc }) => {
    await classDoc.softDelete();
    return ok(null, { message: 'Đã xóa lớp. Có thể khôi phục ở mục Đã xóa.' });
  }),
);
