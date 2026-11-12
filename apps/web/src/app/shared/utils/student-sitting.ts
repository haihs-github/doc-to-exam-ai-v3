// Created by Haihs on 12/11/2026
// Pure helpers of the student side: state labels, code normalising, error mapping, question arrangement, submit retry decision. Port of client/src/utils/studentSitting.js.
import { isApiError, type MyState, type StudentQuestion } from '@doc-to-exam/contract';
import { errorMessage } from '../../core/api-errors';
import { formatDateTime } from './date-format';

export const NOT_GRANTED_MESSAGE =
  'Bạn chưa được cấp quyền vào ca thi này, hãy liên hệ giáo viên để biết thêm chi tiết.';

/** Hand-typed code -> upper case, no whitespace (same as the server's normalizeSittingCode). */
export const normalizeCodeInput = (raw: unknown): string =>
  String(raw ?? '')
    .replace(/\s+/g, '')
    .toUpperCase();
export const isValidCodeFormat = (code: string): boolean => /^[A-Z0-9]{6}$/.test(code);

const STATE_LABELS: Partial<Record<MyState, string>> = {
  not_started: 'Chưa mở',
  open: 'Đang mở',
  in_progress: 'Đang làm dở',
  missed: 'Đã đóng (bạn chưa nộp)',
};
export const STATE_STYLES: Record<MyState, string> = {
  not_started:
    'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700',
  open: 'bg-green-50 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
  in_progress:
    'bg-primary-50 dark:bg-sky-400/10 text-primary-700 dark:text-sky-400 border-primary-300 dark:border-sky-400/40',
  submitted:
    'bg-green-50 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
  missed:
    'bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
};

/** 5 states of the student; `submitted` carries the submit time (or the result once visible). */
export function myStateLabel(s: {
  myState: MyState;
  submittedAt?: string;
  result?: { score: number; maxScore: number };
}): string {
  if (s.myState === 'submitted' && s.result)
    return `Đã có kết quả: ${s.result.score}/${s.result.maxScore}`;
  if (s.myState === 'submitted')
    return s.submittedAt ? `Đã nộp lúc ${formatDateTime(s.submittedAt)}` : 'Đã nộp';
  return STATE_LABELS[s.myState] ?? '';
}

/** "Bắt đầu / Làm tiếp" is offered while open or in progress (the server still decides). */
export const canStartSitting = (myState: MyState): boolean =>
  myState === 'open' || myState === 'in_progress';

/** "(3.75 điểm)" next to a question; '' when the server sent no valid maxScore. */
export function formatQuestionPoints(maxScore: unknown): string {
  const n = Number(maxScore);
  return Number.isFinite(n) && n > 0 ? `(${Math.round(n * 100) / 100} điểm)` : '';
}

export interface TakeError {
  kind: 'not_granted' | 'submitted' | 'error';
  message: string;
}
/** API failure while entering / taking a sitting -> { kind, message }. NOT_GRANTED always uses the product's sentence. */
export function describeTakeError(e: unknown): TakeError {
  if (!isApiError(e))
    return { kind: 'error', message: 'Không thể vào ca thi lúc này. Vui lòng thử lại.' };
  const data = (e.data ?? {}) as { openAt?: string; closeAt?: string; submittedAt?: string };
  switch (e.code) {
    case 'NOT_GRANTED':
      return { kind: 'not_granted', message: NOT_GRANTED_MESSAGE };
    case 'SITTING_NOT_FOUND':
      return { kind: 'error', message: 'Không tìm thấy ca thi. Hãy kiểm tra lại mã ca.' };
    case 'INVALID_CODE':
      return { kind: 'error', message: 'Mã ca thi không hợp lệ.' };
    case 'SITTING_NOT_STARTED':
      return {
        kind: 'error',
        message: `Ca thi chưa mở${data.openAt ? `. Giờ mở: ${formatDateTime(data.openAt)}` : ''}.`,
      };
    case 'SITTING_ENDED':
      return {
        kind: 'error',
        message: `Ca thi đã kết thúc${data.closeAt ? ` lúc ${formatDateTime(data.closeAt)}` : ''}.`,
      };
    case 'ALREADY_SUBMITTED':
      return {
        kind: 'submitted',
        message: `Bạn đã nộp bài${data.submittedAt ? ` lúc ${formatDateTime(data.submittedAt)}` : ''}. Không thể làm lại.`,
      };
    case 'NO_SESSION':
      return {
        kind: 'error',
        message: 'Không tìm thấy phiên làm bài của bạn. Hãy vào lại ca thi để bắt đầu.',
      };
    case 'TIME_UP':
      return { kind: 'error', message: e.message || 'Đã quá thời gian làm bài của bạn.' };
    default:
      return { kind: 'error', message: errorMessage(e) };
  }
}

/** Submit failure: 'done' (409 already recorded, e.g. the server saved but the response was lost) | 'retry' (network, 408, 429, 5xx) | 'stop' (business error). */
export function classifySubmitFailure(e: unknown): 'done' | 'retry' | 'stop' {
  const status = (e as { status?: number } | null)?.status;
  if (status === 409 && isApiError(e) && e.code === 'ALREADY_SUBMITTED') return 'done';
  if (!status || status >= 500 || status === 408 || status === 429) return 'retry';
  return 'stop';
}

/** Orders questions by the session's questionOrder, then permutes options A-D by optionsOrder; the input is not mutated. */
export function arrangeQuestions(
  questions: StudentQuestion[] = [],
  questionOrder: number[] = [],
  optionsOrder: Record<string, string[]> = {},
): StudentQuestion[] {
  let list = questions;
  if (Array.isArray(questionOrder) && questionOrder.length > 0) {
    const rank = new Map(questionOrder.map((id, idx) => [id, idx]));
    const at = (q: StudentQuestion) => rank.get(q.id) ?? 999999;
    list = [...questions].sort((a, b) => at(a) - at(b));
  }
  return list.map((q) => {
    if (q.type === 'essay') return q;
    const order = optionsOrder?.[String(q.id)];
    if (!Array.isArray(order) || order.length === 0) return q;
    const options = { A: '', B: '', C: '', D: '' } as Record<'A' | 'B' | 'C' | 'D', string>;
    (['A', 'B', 'C', 'D'] as const).forEach((key, idx) => {
      options[key] = (q.options as Record<string, string> | undefined)?.[order[idx] ?? key] ?? '';
    });
    return { ...q, options };
  });
}
