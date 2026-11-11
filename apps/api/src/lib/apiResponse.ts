// Created by Haihs on 11/11/2026
// Shared response helpers: fail/ok envelopes, pagination, ObjectId parsing (ported from source server/utils/apiResponse.js).
import { Types } from 'mongoose';
import { HTTP_STATUS, type ApiError, type ApiOk, type ErrorCode } from '@doc-to-exam/contract';

export function fail(
  code: ErrorCode,
  message: string,
  extra?: { field?: string; data?: unknown },
): Response {
  const body = {
    success: false,
    code,
    message,
    ...(extra?.field ? { field: extra.field } : {}),
    ...(extra?.data !== undefined ? { data: extra.data } : {}),
  } satisfies ApiError;
  return Response.json(body, { status: HTTP_STATUS[code] });
}

// Source successes are res.json({ success: true, data, message? }), e.g. controllers/sittingPublicationController.js:30
export function ok<T>(data: T, init: { status?: number; message?: string } = {}): Response {
  return Response.json(
    { success: true, data, ...(init.message ? { message: init.message } : {}) } satisfies ApiOk<T>,
    { status: init.status ?? 200 },
  );
}

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/; // source apiResponse.js:35
export function toObjectId(v: unknown): Types.ObjectId | null {
  return typeof v === 'string' && OBJECT_ID_RE.test(v) ? new Types.ObjectId(v) : null;
}

const MAX_PAGE = 100000; // cap so skip cannot overflow (source apiResponse.js:38)
export function parsePage(
  params: URLSearchParams,
  { defaultLimit = 20, maxLimit = 100 }: { defaultLimit?: number; maxLimit?: number } = {},
): { page: number; limit: number; skip: number } {
  const p = Number.parseInt(params.get('page') ?? '', 10);
  const l = Number.parseInt(params.get('limit') ?? '', 10);
  const page = Number.isInteger(p) && p >= 1 ? Math.min(p, MAX_PAGE) : 1;
  const limit = Number.isInteger(l) && l >= 1 ? Math.min(l, maxLimit) : defaultLimit;
  return { page, limit, skip: (page - 1) * limit };
}

export function pageResult<T>(items: T[], total: number, p: { page: number; limit: number }) {
  return { items, total, page: p.page, limit: p.limit, totalPages: Math.ceil(total / p.limit) };
}
