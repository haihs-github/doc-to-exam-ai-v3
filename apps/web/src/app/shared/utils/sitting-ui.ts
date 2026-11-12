// Created by Haihs on 12/11/2026
// Pure helpers of the sitting pages: Vietnamese error texts, status labels. Port of sittingRules.js (teacher part).
import { isApiError, type SittingStatus } from '@doc-to-exam/contract';
import { errorMessage } from '../../core/api-errors';

export const STATUS_LABEL: Record<SittingStatus, string> = {
  not_started: 'Chưa mở',
  open: 'Đang mở',
  ended: 'Đã đóng',
};

const CODE_MESSAGES: Record<string, string> = {
  INVALID_CLASSES:
    'Danh sách lớp không hợp lệ: lớp phải đang học và bạn phải là giáo viên của lớp.',
  INVALID_STUDENTS: 'Danh sách học sinh không hợp lệ: chỉ chọn học sinh của các lớp được gán.',
  SITTING_TITLE_TAKEN: 'Tên ca thi đã tồn tại. Vui lòng chọn tên khác!',
  SITTING_LOCKED:
    'Ca đang mở và đã có bài nộp hoặc có học sinh đang làm bài nên không thể sửa câu hỏi.',
  SITTING_HAS_SUBMISSIONS: 'Ca thi đã có bài nộp nên không thể xóa.',
  SITTING_CLASSES_CHANGED: 'Tập lớp của ca vừa được thay đổi ở nơi khác, hãy tải lại và thử lại.',
  RESULTS_PUBLISHED:
    'Kết quả đang công bố. Hãy thu hồi công bố trước khi đổi giờ làm ca thi mở lại.',
  CODE_GENERATION_FAILED: 'Không sinh được mã ca duy nhất, hãy thử lại.',
  NOT_FOUND: 'Không tìm thấy ca thi (có thể đã bị xóa).',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
};

/** Server code -> Vietnamese text; overlap keeps the server text (it names the class); 429/503/unknown go through errorMessage. */
export const describeSittingError = (e: unknown, fallback: string): string => {
  if (!isApiError(e)) return fallback;
  const status = (e as { status?: number }).status;
  if (e.code === 'SITTING_OVERLAP') return e.message;
  const mapped = CODE_MESSAGES[e.code];
  return !mapped || status === 429 || status === 503 ? errorMessage(e) : mapped;
};

/** Reads every page (limit 50 each, max 20 pages) of a paged endpoint. */
export const MAX_PAGES = 20;
