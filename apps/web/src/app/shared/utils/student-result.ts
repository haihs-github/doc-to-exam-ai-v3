// Created by Haihs on 15/11/2026
// Pure helpers for the student result page: Vietnamese number format and the fixed messages. Port of studentResult.js (the parts the page still uses).
export const RESULT_UPDATING_MESSAGE = 'Kết quả đang được cập nhật, vui lòng quay lại sau';
export const RESULT_NOT_PUBLISHED_MESSAGE = 'Giáo viên chưa công bố kết quả ca thi này.';
export const NO_SUBMISSION_MESSAGE = 'Bạn không có bài nộp trong ca thi này.';
export const REVIEWING_MESSAGE = 'Bài đang được giáo viên rà soát lại';

/** 8.5 -> "8,5"; rounded to 2 digits, no trailing zeros; not a number -> "0". */
export const formatVnNumber = (value: unknown): string => {
  const n = Number(value);
  return String(Math.round((Number.isFinite(n) ? n : 0) * 100) / 100).replace('.', ',');
};

/** "8,5/10"; '' when a score is missing so a wrong "0/10" is never shown. */
export const formatScoreOverMax = (score: unknown, max: unknown): string => {
  if (
    score == null ||
    max == null ||
    !Number.isFinite(Number(score)) ||
    !Number.isFinite(Number(max))
  )
    return '';
  return `${formatVnNumber(score)}/${formatVnNumber(max)}`;
};
