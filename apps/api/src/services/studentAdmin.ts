// Created by Haihs on 12/11/2026
// Teacher-side student account actions: rename, reset password. Source: server/controllers/studentAdminController.js.
import type { Types } from 'mongoose';
import { ok, toObjectId } from '../lib/apiResponse';
import { parseFullName } from '../lib/authValidation';
import type { ClassHandler } from '../lib/classAuth';
import { HttpError, readJson } from '../lib/handler';
import { hashTempPassword } from '../lib/passwordHash';
import { ClassMemberModel } from '../models/ClassMember';
import { UserModel } from '../models/User';
import { generateTempPassword } from './tempPassword';

const noStore = (res: Response) => {
  res.headers.set('Cache-Control', 'no-store');
  return res;
};

/** The student must be an APPROVED member of THIS class (IDOR guard); otherwise STUDENT_NOT_FOUND. */
async function findClassStudent(classId: Types.ObjectId, rawUserId: string | undefined) {
  const userId = toObjectId(rawUserId);
  const notFound = new HttpError('STUDENT_NOT_FOUND', 'Không tìm thấy học sinh.');
  if (!userId) throw notFound;
  const member = await ClassMemberModel.exists({
    classId,
    userId,
    memberRole: 'student',
    status: 'approved',
  });
  const student = member ? await UserModel.findOne({ _id: userId, role: 'student' }) : null;
  if (!student) throw notFound;
  return student;
}

export const updateStudentName: ClassHandler = async (req, { classDoc, params }) => {
  const body = (await readJson(req, 4096)) as { fullName?: unknown } | null;
  const name = parseFullName(body && typeof body === 'object' ? body.fullName : undefined); // only fullName is read
  if (!name)
    throw new HttpError(
      'VALIDATION',
      'Họ và tên không hợp lệ (2 đến 255 ký tự, bắt đầu bằng chữ cái, không chứa chữ số hay ký tự đặc biệt).',
      { field: 'fullName' },
    );
  const student = await findClassStudent(classDoc._id, params.userId);
  student.fullName = name;
  await student.save(); // save() runs pre('validate'), which refreshes nameSearch
  return noStore(
    ok({
      userId: String(student._id),
      fullName: student.fullName,
      phoneNumber: student.phoneNumber,
    }),
  );
};

export const resetStudentPassword: ClassHandler = async (_req, { classDoc, params }) => {
  const student = await findClassStudent(classDoc._id, params.userId);
  const temporaryPassword = generateTempPassword();
  const password = await hashTempPassword(temporaryPassword); // gate: SERVER_BUSY (503) before any write
  // $inc tokenVersion revokes every old session; the temp password is returned this once and never stored in clear.
  await UserModel.updateOne(
    { _id: student._id },
    { $set: { password, mustChangePassword: true }, $inc: { tokenVersion: 1 } },
  );
  return noStore(
    ok({
      userId: String(student._id),
      fullName: student.fullName,
      phoneNumber: student.phoneNumber,
      temporaryPassword,
    }),
  );
};
