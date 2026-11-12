// Created by Haihs on 12/11/2026
// Student import from CSV/XLSX rows: per-row validation, create accounts with temp passwords, add to the class. Port of importStudents in studentAdminController.js.
import type { ImportResultRow, ImportSummary } from '@doc-to-exam/contract';
import type { Types } from 'mongoose';
import { parseFullName } from '../lib/authValidation';
import { HttpError } from '../lib/handler';
import { hashTempPassword } from '../lib/passwordHash';
import { normalizePhone, PHONE_RE } from '../lib/phone';
import { toSearchKey } from '../lib/textUtils';
import { ClassMemberModel } from '../models/ClassMember';
import { UserModel } from '../models/User';
import { generateTempPassword } from './tempPassword';

export const CSV_MAX_ROWS = 200;
const HASH_BATCH = 2; // bulk lane: leaves bcrypt slots free for logins while 200 temp passwords are hashed
const PHONE_HEADERS = new Set(['sdt', 'so dien thoai', 'dien thoai', 'phonenumber', 'phone']);
const BAD_PHONE =
  'Số điện thoại phải bắt đầu bằng 0, gồm 10-11 chữ số, không có ký tự khác (không dùng +84).';
const BAD_NAME =
  'Họ và tên không hợp lệ (2 đến 255 ký tự, bắt đầu bằng chữ cái, không chứa chữ số hay ký tự đặc biệt).';

interface DataRow {
  row: number;
  cells: string[];
}

/** Records -> data rows (row = position in the file incl. header and blank lines). 422 when empty or > 200 rows. */
export function rowsFromRecords(records: string[][]): DataRow[] {
  const hasHeader = records.length > 0 && PHONE_HEADERS.has(toSearchKey(records[0][1]));
  const data = records
    .map((cells, i) => ({ row: i + 1, cells }))
    .slice(hasHeader ? 1 : 0)
    .filter(({ cells }) => cells.some((c) => c.trim() !== ''));
  if (data.length === 0) throw new HttpError('CSV_INVALID', 'File không có dòng dữ liệu nào.');
  if (data.length > CSV_MAX_ROWS)
    throw new HttpError('CSV_TOO_MANY_ROWS', `Giới hạn ${CSV_MAX_ROWS} người mỗi lần.`);
  return data;
}

const chunks = <T>(list: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) =>
    list.slice(i * size, i * size + size),
  );

export async function importStudents(
  classId: Types.ObjectId,
  actorId: Types.ObjectId,
  data: DataRow[],
): Promise<{ summary: ImportSummary; results: ImportResultRow[] }> {
  const results: ImportResultRow[] = [];
  const valid: { row: number; fullName: string; phoneNumber: string }[] = [];
  const seen = new Set<string>();

  // 1. Validate each row: a bad row is reported by number, the rest still runs.
  for (const { row, cells } of data) {
    const rawName = (cells[0] ?? '').trim();
    const rawPhone = (cells[1] ?? '').trim();
    const error = (message: string) =>
      results.push({ row, status: 'error', fullName: rawName, phoneNumber: rawPhone, message });
    if (cells.length < 2) {
      error('Thiếu cột (cần họ tên và số điện thoại).');
      continue;
    }
    const fullName = parseFullName(cells[0]);
    const phoneNumber = normalizePhone(cells[1]);
    if (!fullName) error(BAD_NAME);
    else if (!PHONE_RE.test(phoneNumber)) error(BAD_PHONE);
    else if (seen.has(phoneNumber)) error('Số điện thoại bị trùng trong file.');
    else {
      seen.add(phoneNumber);
      valid.push({ row, fullName, phoneNumber });
    }
  }

  // 2. One lookup by $in. A phone that belongs to a non-student gets a generic error (no role disclosure).
  const existing = new Map(
    (
      await UserModel.find({ phoneNumber: { $in: valid.map((v) => v.phoneNumber) } })
        .select('fullName phoneNumber role')
        .lean()
    ).map((u) => [u.phoneNumber, u]),
  );
  const toCreate = valid.filter((v) => !existing.has(v.phoneNumber));

  // 3. Hash everything (through the gate) BEFORE writing: a full queue gives 503 with nothing created.
  const passwords = toCreate.map(() => generateTempPassword());
  const hashes: string[] = [];
  for (const batch of chunks(passwords, HASH_BATCH))
    hashes.push(...(await Promise.all(batch.map((p) => hashTempPassword(p)))));

  const members: {
    row: number;
    userId: Types.ObjectId;
    fullName: string;
    phoneNumber: string;
    temporaryPassword?: string;
  }[] = [];
  for (const v of valid) {
    const user = existing.get(v.phoneNumber);
    if (!user) continue;
    if (user.role === 'student')
      members.push({
        row: v.row,
        userId: user._id,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
      });
    else
      results.push({
        row: v.row,
        status: 'error',
        fullName: v.fullName,
        phoneNumber: v.phoneNumber,
        message: 'Không thể thêm số điện thoại này làm học sinh.',
      });
  }
  for (const [i, v] of toCreate.entries()) {
    try {
      const user = await UserModel.create({
        phoneNumber: v.phoneNumber,
        fullName: v.fullName,
        password: hashes[i],
        role: 'student',
        mustChangePassword: true,
      });
      members.push({
        row: v.row,
        userId: user._id,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        temporaryPassword: passwords[i],
      });
    } catch (err) {
      if ((err as { code?: unknown }).code !== 11000) throw err;
      // Raced with a registration between lookup and create: do not guess its role, ask to retry.
      results.push({
        row: v.row,
        status: 'error',
        fullName: v.fullName,
        phoneNumber: v.phoneNumber,
        message: 'Số điện thoại vừa được đăng ký, hãy import lại.',
      });
    }
  }

  // 4. Attach to the class: pending -> approved; missing -> insert; approved -> untouched (idempotent).
  const now = new Date();
  const current = new Map(
    (
      await ClassMemberModel.find({ classId, userId: { $in: members.map((m) => m.userId) } })
        .select('userId status')
        .lean()
    ).map((m) => [String(m.userId), m.status]),
  );
  const pendingIds = members
    .filter((m) => current.get(String(m.userId)) === 'pending')
    .map((m) => m.userId);
  if (pendingIds.length)
    await ClassMemberModel.updateMany(
      { classId, userId: { $in: pendingIds }, status: 'pending' },
      { $set: { status: 'approved', approvedAt: now, approvedBy: actorId } },
    );
  const fresh = members.filter((m) => !current.has(String(m.userId)));
  if (fresh.length) {
    try {
      await ClassMemberModel.insertMany(
        fresh.map((m) => ({
          classId,
          userId: m.userId,
          memberRole: 'student',
          status: 'approved',
          source: 'csv',
          addedBy: actorId,
          requestedAt: now,
          approvedAt: now,
          approvedBy: actorId,
        })),
        { ordered: false },
      );
    } catch (err) {
      // Only duplicate keys are ignorable (someone else just added them). Any other write error is rethrown: no false success.
      const writeErrors =
        (err as { writeErrors?: { code?: number; err?: { code?: number } }[] }).writeErrors ?? [];
      if (!writeErrors.length || !writeErrors.every((e) => (e.code ?? e.err?.code) === 11000))
        throw err;
    }
  }
  for (const m of members) {
    const was = current.get(String(m.userId));
    results.push({
      row: m.row,
      status: m.temporaryPassword ? 'created' : was === 'approved' ? 'alreadyMember' : 'added',
      fullName: m.fullName,
      phoneNumber: m.phoneNumber,
      ...(m.temporaryPassword ? { temporaryPassword: m.temporaryPassword } : {}),
    });
  }

  results.sort((a, b) => a.row - b.row);
  const count = (s: ImportResultRow['status']) => results.filter((r) => r.status === s).length;
  return {
    summary: {
      total: results.length,
      created: count('created'),
      added: count('added'),
      alreadyMember: count('alreadyMember'),
      errors: count('error'),
    },
    results,
  };
}
