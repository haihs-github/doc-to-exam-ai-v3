// Created by Haihs on 11/11/2026
// Route handler helpers: HttpError, readJson, withErrors (never leaks internal errors).
import type { ErrorCode } from '@doc-to-exam/contract';
import { fail } from './apiResponse';

export class HttpError extends Error {
  // Haihs: message bắt buộc (bỏ mặc định = code) - start
  // đóng code cũ
  // constructor(public code: ErrorCode, message?: string, public extra?: { field?: string; data?: unknown }) {
  //     super(message ?? code);
  // constructor(public code: ErrorCode, message: string, public extra?: { field?: string; data?: unknown }) {
  // extra.status overrides the default HTTP status of the code (see fail), e.g. CSV_INVALID 400 for a broken multipart
  constructor(public code: ErrorCode, message: string, public extra?: { field?: string; data?: unknown; status?: number }) {
    super(message);
  // Haihs: message bắt buộc (bỏ mặc định = code) - end
    this.name = 'HttpError';
  }
}

// Haihs: readJson có trần byte (Content-Length + độ dài thực đọc) - start
// đóng code cũ
// export async function readJson(req: Request): Promise<unknown> {
//   try {
//     return await req.json();
//   } catch {
//     throw new HttpError('VALIDATION', 'Dữ liệu không hợp lệ.');
//   }
// }
export async function readJson(req: Request, maxBytes = 1_048_576): Promise<unknown> {
  const tooLarge = () => new HttpError('PAYLOAD_TOO_LARGE', 'Dữ liệu gửi lên quá lớn');
  const declared = Number(req.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw tooLarge();
  // Stream and stop at the cap so a chunked body cannot be buffered unbounded.
  const reader = req.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {}); // a cancel failure must not mask the 413
      throw tooLarge();
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(new TextDecoder().decode(Buffer.concat(chunks))); // TextDecoder drops a BOM, like req.json()
  } catch {
    throw new HttpError('VALIDATION', 'Dữ liệu không hợp lệ.');
  }
}
// Haihs: readJson có trần byte (Content-Length + độ dài thực đọc) - end

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next passes a route-specific ctx
// type Handler = (req: Request, ctx?: any) => Promise<Response>; // đóng code cũ // Haihs: export Handler cho withRateLimit - start - end
export type Handler = (req: Request, ctx?: any) => Promise<Response>; // eslint-disable-line @typescript-eslint/no-explicit-any -- Next passes a route-specific ctx // Haihs: export Handler cho withRateLimit - start - end

// Haihs: withErrors generic theo ctx của route (params có kiểu), nợ M0 - start
// đóng code cũ
// export function withErrors(h: Handler): Handler {
//   return async (req, ctx) => {
//     try {
//       return await h(req, ctx);
export function withErrors<C = unknown>(h: (req: Request, ctx: C) => Promise<Response>): (req: Request, ctx?: C) => Promise<Response> {
  return async (req, ctx) => {
    try {
      return await h(req, ctx as C);
// Haihs: withErrors generic theo ctx của route (params có kiểu), nợ M0 - end
    } catch (err) {
      // Haihs: SERVER_BUSY kèm Retry-After cho mọi route - start
      // đóng code cũ
      // if (err instanceof HttpError) return fail(err.code, err.message, err.extra);
      if (err instanceof HttpError) {
        const res = fail(err.code, err.message, err.extra);
        if (err.code === 'SERVER_BUSY') res.headers.set('Retry-After', '5');
        return res;
      }
      // Haihs: SERVER_BUSY kèm Retry-After cho mọi route - end
      // Haihs: ném Response trả nguyên, rethrow lỗi điều hướng Next (digest), lỗi Mongoose -> 400 (nợ M0) - start
      if (err instanceof Response) return err;
      if (typeof (err as { digest?: unknown } | null)?.digest === 'string') throw err; // redirect()/notFound()
      const name = (err as { name?: unknown } | null)?.name;
      if (name === 'ValidationError' || name === 'CastError') {
        // A setter-thrown HttpError arrives wrapped by Mongoose: surface its own code/message/field.
        const inner = findHttpError(err);
        if (inner) return fail(inner.code, inner.message, inner.extra);
        console.error(`Lỗi ${req.method} ${new URL(req.url).pathname}:`, err);
        return fail('VALIDATION', 'Dữ liệu không hợp lệ.'); // fixed text: Mongoose messages echo field values
      }
      // Haihs: ném Response trả nguyên, rethrow lỗi điều hướng Next (digest), lỗi Mongoose -> 400 (nợ M0) - end
      console.error(`Lỗi ${req.method} ${new URL(req.url).pathname}:`, err);
      return fail('INTERNAL', 'Lỗi máy chủ');
    }
  };
}

// Haihs: tìm HttpError bị Mongoose bọc (reason/cause/errors), giới hạn độ sâu (nợ M0) - start
function findHttpError(e: unknown, depth = 0): HttpError | undefined {
  if (e instanceof HttpError) return e;
  if (depth >= 5 || !e || typeof e !== 'object') return undefined;
  const x = e as { reason?: unknown; cause?: unknown; errors?: Record<string, unknown> };
  for (const c of [x.reason, x.cause, ...Object.values(x.errors ?? {})]) {
    const f = findHttpError(c, depth + 1);
    if (f) return f;
  }
  return undefined;
}
// Haihs: tìm HttpError bị Mongoose bọc (reason/cause/errors), giới hạn độ sâu (nợ M0) - end
