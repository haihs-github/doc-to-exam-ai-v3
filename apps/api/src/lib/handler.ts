// Created by Haihs on 11/11/2026
// Route handler helpers: HttpError, readJson, withErrors (never leaks internal errors).
import type { ErrorCode } from '@doc-to-exam/contract';
import { fail } from './apiResponse';

export class HttpError extends Error {
  constructor(public code: ErrorCode, message?: string, public extra?: { field?: string; data?: unknown }) {
    super(message ?? code);
    this.name = 'HttpError';
  }
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError('VALIDATION', 'Dữ liệu không hợp lệ.');
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next passes a route-specific ctx
type Handler = (req: Request, ctx?: any) => Promise<Response>;

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
