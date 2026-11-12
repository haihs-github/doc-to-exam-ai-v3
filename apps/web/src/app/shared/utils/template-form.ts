// Created by Haihs on 12/11/2026
// Pure helpers of the template pages: form validation per field, trash labels, error texts. Port of templateForm.js / templateTrash.js.
import { isApiError } from '@doc-to-exam/contract';
import { errorMessage } from '../../core/api-errors';
import { validateQuestions, type EditorQuestion } from './exam-questions';
import { validateMaxLength } from './limits';

export function validateTemplateForm(f: {
  title: string;
  description?: string;
  questions: EditorQuestion[];
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!String(f.title ?? '').trim()) errors['title'] = 'Vui lòng nhập tên đề mẫu.';
  else {
    const e = validateMaxLength(f.title, 'TITLE_MAX', 'Tên đề mẫu');
    if (e) errors['title'] = e;
  }
  const d = validateMaxLength(f.description ?? '', 'DESCRIPTION_MAX', 'Mô tả đề mẫu');
  if (d) errors['description'] = d;
  if ((f.questions ?? []).length === 0) errors['questions'] = 'Đề phải có ít nhất 1 câu hỏi.';
  return { ...errors, ...validateQuestions(f.questions) };
}

/** Default retention only for the warning before deleting; the real number comes from daysLeft. */
export const TRASH_RETENTION_DAYS = 30;
export const daysLeftLabel = (daysLeft: unknown): string => {
  const n = Number(daysLeft);
  return !Number.isFinite(n) || n <= 0 ? 'Sắp hết hạn' : `Còn ${n} ngày`;
};

const CODE_MESSAGES: Record<string, string> = {
  TEMPLATE_NOT_IN_TRASH: 'Chỉ xóa vĩnh viễn được đề đang ở mục Đã xoá. Hãy tải lại danh sách.',
  NOT_FOUND:
    'Không tìm thấy đề mẫu (có thể đã bị xóa, khôi phục hoặc hết hạn). Hãy tải lại danh sách.',
  TEMPLATE_TITLE_TAKEN: 'Tên đề mẫu đã tồn tại. Vui lòng chọn tên khác!',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
};
export const describeTemplateError = (e: unknown, fallback: string): string => {
  if (!isApiError(e)) return fallback;
  const status = (e as { status?: number }).status;
  const mapped = CODE_MESSAGES[e.code];
  return !mapped || status === 429 || status === 503 ? errorMessage(e) : mapped;
};
export const isTitleTaken = (e: unknown): boolean =>
  isApiError(e) && e.code === 'TEMPLATE_TITLE_TAKEN';
export const validateRestoreTitle = (v: unknown): string =>
  String(v ?? '').trim()
    ? validateMaxLength(String(v), 'TITLE_MAX', 'Tên đề mẫu')
    : 'Tên đề mẫu không được để trống.';

export const DRAFT_KEY = 'draft_template';
