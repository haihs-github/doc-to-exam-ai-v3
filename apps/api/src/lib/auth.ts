// Created by Haihs on 11/11/2026
// Route wrappers withAuth / withPermission / withApiKey and the shared authenticateRequest (port of server/middlewares/authMiddleware.js).
import mongoose from 'mongoose';
import { UserModel, type IUser } from '../models/User';
import { fail } from './apiResponse';
import { connectDb } from './db';
import { HttpError, type Handler } from './handler';
import { verifyToken } from './jwt';
import { hasPermission } from './rbac';

export type UserDoc = mongoose.HydratedDocument<IUser>;
/** Next route ctx is preserved (params), plus the authenticated user. */
export interface AuthCtx {
  user: UserDoc;
  userId: string;
  params?: Promise<Record<string, string | string[]>>;
}
export type AuthHandler = (req: Request, ctx: AuthCtx) => Promise<Response>;

const UNAUTH_MSG =
  'Bạn chưa đăng nhập hoặc phiên đăng nhập không hợp lệ. Vui lòng đăng nhập để tiếp tục.';
const unauthenticated = (message = UNAUTH_MSG) => new HttpError('UNAUTHENTICATED', message);

// Exactly "Bearer" + one space + one token (case-sensitive, like source `startsWith('Bearer ')`, but no extra parts).
const BEARER_RE = /^Bearer (\S+)$/;
// Allowed while user.mustChangePassword: method + exact pathname (trailing slash normalised, query ignored).
const ALLOWED_WHEN_MUST_CHANGE = new Set([
  'GET /api/auth/me',
  'POST /api/auth/change-password',
  'POST /api/auth/logout-all',
]);

/**
 * Shared by withAuth and the Milestone 6 upload route. Throws HttpError (401/403); infrastructure errors propagate (500).
 * The password hash is not loaded.
 */
export async function authenticateRequest(req: Request): Promise<UserDoc> {
  const token = BEARER_RE.exec(req.headers.get('authorization') ?? '')?.[1];
  if (!token) throw unauthenticated();

  let decoded: { id: string; tv: number };
  try {
    decoded = verifyToken(token);
  } catch {
    throw unauthenticated(); // same message for every verify failure: no hint which
  }
  if (!mongoose.isValidObjectId(decoded.id)) throw unauthenticated();

  await connectDb();
  const user = await UserModel.findById(decoded.id).select('-password');
  if (!user) throw unauthenticated();
  if (decoded.tv !== (user.tokenVersion ?? 0))
    throw unauthenticated('Phiên đăng nhập đã bị thu hồi. Vui lòng đăng nhập lại.');

  if (user.mustChangePassword) {
    const path = new URL(req.url).pathname.replace(/\/+$/, '');
    if (!ALLOWED_WHEN_MUST_CHANGE.has(`${req.method} ${path}`)) {
      throw new HttpError('MUST_CHANGE_PASSWORD', 'Bạn cần đổi mật khẩu để tiếp tục.');
    }
  }
  return user;
}

export function withAuth(h: AuthHandler): Handler {
  return async (req, ctx) => {
    const user = await authenticateRequest(req);
    return h(req, { ...ctx, user, userId: user.id });
  };
}

/** Includes authentication (do not also wrap in withAuth). Put withRateLimit INSIDE h for user-keyed buckets. */
export function withPermission(perm: string, h: AuthHandler): Handler {
  return withAuth(async (req, ctx) => {
    if (!(await hasPermission(ctx.user.role, perm))) {
      return fail('FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.');
    }
    return h(req, ctx);
  });
}

/** Inner wrapper (use inside withAuth/withPermission): the teacher needs a Gemini API key. */
export function withApiKey(h: AuthHandler): AuthHandler {
  return async (req, ctx) => {
    if (!ctx.user.geminiApiKey?.trim()) {
      return fail(
        'REQUIRE_API_KEY',
        'Bạn chưa cấu hình Gemini API Key. Vui lòng thêm API Key vào tài khoản để sử dụng tính năng tạo đề thi bằng AI.',
      );
    }
    return h(req, ctx);
  };
}
