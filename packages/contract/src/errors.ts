// Created by Haihs on 11/11/2026
// Shared API error/response types, error-code to HTTP status table and isApiError guard.
export type ErrorCode =
  | 'VALIDATION'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'PAYLOAD_TOO_LARGE'
  | 'MUST_CHANGE_PASSWORD'
  | 'REQUIRE_API_KEY'
  | 'INTERNAL';

export interface ApiError {
  success: false;
  code: ErrorCode;
  message: string;
  field?: string;
  data?: unknown;
}

export interface ApiOk<T> {
  success: true;
  data: T;
  message?: string;
}

// Source refs: ts_doc_to_exam_ai/server/...
export const HTTP_STATUS: Record<ErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHENTICATED: 401, // middlewares/authMiddleware.js:84
  FORBIDDEN: 403, // middlewares/authMiddleware.js:100
  NOT_FOUND: 404, // middlewares/authMiddleware.js:120
  CONFLICT: 409, // no source evidence; standard HTTP 409 (brief)
  RATE_LIMITED: 429, // middlewares/rateLimit.js:72
  PAYLOAD_TOO_LARGE: 413, // middlewares/rateLimit.js:161
  MUST_CHANGE_PASSWORD: 403, // middlewares/authMiddleware.js:59
  REQUIRE_API_KEY: 400, // middlewares/authMiddleware.js:166 (source sends requireApiKey:true, no code)
  INTERNAL: 500, // middlewares/authMiddleware.js:69 (source wire code is 'INTERNAL_ERROR')
};

// shortcut: code is only checked to be a string, not an ErrorCode member; tighten when a client needs the narrowing
export function isApiError(x: unknown): x is ApiError {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  // Haihs: truy cập bracket để qua TS4111 dưới Angular strict - start
  // đóng code cũ
  // return o.success === false && typeof o.code === 'string' && typeof o.message === 'string';
  return (
    o['success'] === false && typeof o['code'] === 'string' && typeof o['message'] === 'string'
  );
  // Haihs: truy cập bracket để qua TS4111 dưới Angular strict - end
}
