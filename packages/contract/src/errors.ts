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
  // Haihs: thêm mã lỗi auth M1 - start
  | 'INVALID_CREDENTIALS'
  | 'PHONE_TAKEN'
  | 'SECRET_KEY_INVALID'
  | 'SERVER_BUSY'
  // Haihs: thêm mã lỗi auth M1 - end
  // Haihs: thêm mã lỗi lớp học M2 - start
  | 'INVITE_INVALID'
  | 'CLASS_CODE_TAKEN'
  | 'STUDENT_NOT_FOUND'
  | 'TEACHER_NOT_FOUND'
  | 'CLASS_NOT_ACCEPTING'
  | 'LAST_TEACHER'
  | 'CSV_INVALID'
  | 'CSV_TOO_MANY_ROWS'
  // Haihs: thêm mã lỗi lớp học M2 - end
  // Haihs: thêm mã lỗi đề mẫu M3 - start
  | 'TEMPLATE_TITLE_TAKEN'
  | 'TEMPLATE_NOT_IN_TRASH'
  // Haihs: thêm mã lỗi đề mẫu M3 - end
  // Haihs: thêm mã lỗi ca thi M4 - start
  | 'INVALID_CLASSES'
  | 'INVALID_STUDENTS'
  | 'SITTING_TITLE_TAKEN'
  | 'SITTING_OVERLAP'
  | 'CODE_GENERATION_FAILED'
  | 'SITTING_LOCKED'
  | 'RESULTS_PUBLISHED'
  | 'SITTING_HAS_SUBMISSIONS'
  | 'SITTING_CLASSES_CHANGED'
  // Haihs: thêm mã lỗi ca thi M4 - end
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
  // Haihs: status mã lỗi auth M1 - start
  INVALID_CREDENTIALS: 401, // controllers/authController.js:197
  PHONE_TAKEN: 409, // controllers/authController.js:252
  SECRET_KEY_INVALID: 403, // controllers/authController.js:247
  SERVER_BUSY: 503, // controllers/authController.js:204
  // Haihs: status mã lỗi auth M1 - end
  // Haihs: status mã lỗi lớp học M2 - start
  INVITE_INVALID: 404, // controllers/classController.js:196
  CLASS_CODE_TAKEN: 409, // controllers/classController.js:27
  STUDENT_NOT_FOUND: 404, // controllers/studentAdminController.js:44, memberController.js:19,22
  TEACHER_NOT_FOUND: 404, // controllers/memberController.js:20,22
  CLASS_NOT_ACCEPTING: 409, // controllers/memberController.js:27
  LAST_TEACHER: 409, // controllers/memberController.js:183
  CSV_INVALID: 422, // controllers/studentAdminController.js:86 (source also sends 400 for a bad multipart request at :81; one status per code here)
  CSV_TOO_MANY_ROWS: 422, // controllers/studentAdminController.js:115
  // Haihs: status mã lỗi lớp học M2 - end
  // Haihs: status mã lỗi đề mẫu M3 - start
  TEMPLATE_TITLE_TAKEN: 409, // controllers/templateController.js:53
  TEMPLATE_NOT_IN_TRASH: 409, // controllers/templateController.js:~270
  // Haihs: status mã lỗi đề mẫu M3 - end
  // Haihs: status mã lỗi ca thi M4 - start
  INVALID_CLASSES: 400, // controllers/sittingController.js:~52
  INVALID_STUDENTS: 400, // controllers/sittingController.js:~53
  SITTING_TITLE_TAKEN: 409, // controllers/sittingController.js (createSitting)
  SITTING_OVERLAP: 409, // controllers/sittingController.js (overlapError)
  CODE_GENERATION_FAILED: 503, // services/sittingCode.js
  SITTING_LOCKED: 409, // controllers/sittingController.js (updateSitting)
  RESULTS_PUBLISHED: 409, // controllers/sittingController.js (updateSitting)
  SITTING_HAS_SUBMISSIONS: 409, // controllers/sittingController.js (deleteSitting)
  SITTING_CLASSES_CHANGED: 409, // controllers/sittingController.js (updateClasses)
  // Haihs: status mã lỗi ca thi M4 - end
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
