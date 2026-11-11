// Created by Haihs on 11/11/2026
// Route handler helpers: HttpError, readJson, withErrors (never leaks internal errors).
import type { ErrorCode } from '@doc-to-exam/contract';
import { fail } from './apiResponse';

export class HttpError extends Error {
  // Haihs: message bắt buộc (bỏ mặc định = code) - start
  // đóng code cũ
  // constructor(public code: ErrorCode, message?: string, public extra?: { field?: string; data?: unknown }) {
  //     super(message ?? code);
  constructor(public code: ErrorCode, message: string, public extra?: { field?: string; data?: unknown }) {
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

export function withErrors(h: Handler): Handler {
  return async (req, ctx) => {
    try {
      return await h(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) return fail(err.code, err.message, err.extra);
      console.error(`Lỗi ${req.method} ${new URL(req.url).pathname}:`, err);
      return fail('INTERNAL', 'Lỗi máy chủ');
    }
  };
}
