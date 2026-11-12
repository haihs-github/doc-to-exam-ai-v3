// Created by Haihs on 12/11/2026
// Pure validation of the sitting form (title, description, times, duration, classes). Port of validateSittingForm in sittingRules.js.
import { parseVnDateTime } from './vn-datetime';
import { validateMaxLength } from './limits';

export const MAX_DURATION_MINUTES = 600;

export interface SittingFormValues {
  templateId?: string; // required on create only
  title: string;
  description: string;
  openAt: string; // "dd/mm/yyyy hh:mm" (UTC+7)
  closeAt: string;
  duration: string;
  classIds: string[];
  requireTemplate?: boolean;
  requireFutureClose?: boolean;
}

export function validateSittingForm(
  v: SittingFormValues,
  now = new Date(),
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (v.requireTemplate && !v.templateId) errors['templateId'] = 'Hãy chọn đề mẫu.';
  if (!v.title.trim()) errors['title'] = 'Vui lòng nhập tên ca thi.';
  else {
    const e = validateMaxLength(v.title, 'TITLE_MAX', 'Tên ca thi');
    if (e) errors['title'] = e;
  }
  const d = validateMaxLength(v.description, 'DESCRIPTION_MAX', 'Mô tả ca thi');
  if (d) errors['description'] = d;
  const open = parseVnDateTime(v.openAt);
  const close = parseVnDateTime(v.closeAt);
  if (!open) errors['openAt'] = 'Giờ mở ca không hợp lệ (dd/mm/yyyy hh:mm).';
  if (!close) errors['closeAt'] = 'Giờ đóng ca không hợp lệ (dd/mm/yyyy hh:mm).';
  if (open && close) {
    if (close <= open) errors['closeAt'] = 'Giờ đóng ca phải sau giờ mở ca.';
    else if (v.requireFutureClose && close <= now)
      errors['closeAt'] = 'Giờ đóng ca phải ở tương lai.';
  }
  const minutes = Number(v.duration);
  if (!/^\d+$/.test(v.duration.trim()) || !Number.isSafeInteger(minutes) || minutes < 1)
    errors['duration'] = 'Thời gian làm bài phải là số nguyên từ 1 phút trở lên.';
  else if (minutes > MAX_DURATION_MINUTES)
    errors['duration'] = `Thời gian làm bài tối đa là ${MAX_DURATION_MINUTES} phút.`;
  if (v.classIds.length === 0) errors['classIds'] = 'Hãy chọn ít nhất một lớp.';
  return errors;
}
