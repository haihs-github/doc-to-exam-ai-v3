// Created by Haihs on 11/11/2026
// Vietnamese user-facing message from an API failure; port of describeApiError (client/src/utils/apiErrors.js:23-30).
import { isApiError } from '@doc-to-exam/contract';
import { getRetryAfterFromError } from '../shared/utils/retry';

const FALLBACK = 'Có lỗi xảy ra. Vui lòng thử lại!'; // apiErrors.js:21

// apiErrors.js:18
const withWait = (text: string, error: unknown) => {
  const ms = getRetryAfterFromError(error);
  return ms ? `${text} Vui lòng thử lại sau khoảng ${Math.ceil(ms / 1000)} giây.` : text;
};

// Never returns stack or internal detail: non-contract errors get the generic fallback.
export const errorMessage = (e: unknown): string => {
  if (!isApiError(e)) return FALLBACK;
  const status = (e as { status?: number }).status;
  if (status === 0) return 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.'; // apiErrors.js:24
  if (status === 429 || e.code === 'RATE_LIMITED') return withWait('Bạn thao tác quá nhiều lần.', e); // :26 (data.code RATE_LIMITED)
  if (status === 503) return withWait('Hệ thống đang bận.', e); // :27 (SERVER_BUSY has no contract code; status only)
  // Haihs: ghi chú trên đã lỗi thời, contract nay có mã SERVER_BUSY; vẫn khớp theo status 503 - start - end
  return e.message || FALLBACK; // :28
};
