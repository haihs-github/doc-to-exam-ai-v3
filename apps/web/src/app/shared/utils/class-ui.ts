// Created by Haihs on 12/11/2026
// Pure helpers for the class UI (error text, restore-code check, school-year label); port of classRules.js/classUi.js.
import { isApiError } from '@doc-to-exam/contract';
import { errorMessage } from '../../core/api-errors';
import { upperClassCode } from './class-form';
import { LIMITS } from './limits';

export const formatSchoolYear = (start: number, end: number): string => `${start}-${end}`;

/** Restore refused because another class took the code meanwhile. */
export const isClassCodeTaken = (e: unknown): boolean =>
  isApiError(e) && e.code === 'CLASS_CODE_TAKEN';

const CODE_MESSAGES: Record<string, string> = {
  LAST_TEACHER: 'Lớp phải còn ít nhất một giáo viên: hãy thêm giáo viên khác hoặc xóa lớp.',
  CLASS_NOT_ACCEPTING: 'Lớp đã tốt nghiệp, hãy chuyển về Đang học để thêm thành viên.',
  CLASS_CODE_TAKEN: 'Mã lớp đã được lớp khác sử dụng. Hãy chọn mã khác.',
  TEACHER_NOT_FOUND: 'Không tìm thấy giáo viên với số điện thoại này.',
  NOT_FOUND: 'Không tìm thấy lớp (có thể đã bị xoá hoặc bạn không còn trong lớp).',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
  STUDENT_NOT_FOUND: 'Không tìm thấy học sinh',
  CSV_TOO_MANY_ROWS: 'File vượt giới hạn 200 người mỗi lần, hãy chia nhỏ file.',
  PAYLOAD_TOO_LARGE: 'File quá lớn (CSV tối đa 256KB, Excel .xlsx tối đa 1MB).',
};

/** Server code -> Vietnamese text; network/429/503 and unknown codes go through errorMessage; non-API errors get `fallback`. */
export const describeClassError = (e: unknown, fallback: string): string => {
  if (!isApiError(e)) return fallback;
  const status = (e as { status?: number }).status;
  const mapped = CODE_MESSAGES[e.code];
  return !mapped || status === 429 || status === 503 ? errorMessage(e) : mapped;
};

export type RestoreCode = { ok: true; code: string } | { ok: false; error: string };

/** New code typed in the restore dialog: trim + upper-case; empty / too long is an error. */
export const validateRestoreCode = (raw: string): RestoreCode => {
  const code = upperClassCode(raw).trim();
  if (!code) return { ok: false, error: 'Hãy nhập mã lớp mới.' };
  if (code.length > LIMITS.CLASS_CODE_MAX)
    return { ok: false, error: `Mã lớp tối đa ${LIMITS.CLASS_CODE_MAX} ký tự.` };
  return { ok: true, code };
};
