// Created by Haihs on 11/11/2026
// Route wrappers withAuth / withPermission / withApiKey and the shared authenticateRequest (port of server/middlewares/authMiddleware.js).
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { UserModel, type IUser } from '../models/User';
import { fail } from './apiResponse';
import { connectDb } from './db';
import { HttpError, type Handler } from './handler';
import { InvalidTokenError, verifyToken } from './jwt';
import { hasPermission, PERMISSIONS } from './rbac';

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
const ID_RE = /^[0-9a-f]{24}$/i;
const KNOWN_PERMISSIONS = new Set(Object.values(PERMISSIONS).flat());

/** allowWhenMustChangePassword: only `me`, `change-password`, `logout-all` routes set it; any other route answers 403 to such users. */
export interface AuthOptions {
  allowWhenMustChangePassword?: boolean;
}
/**
 * Shared by withAuth and the Milestone 6 upload route. Throws HttpError (401/403); infrastructure errors propagate (500).
 * The password hash is not loaded.
 */
export async function authenticateRequest(req: Request, opts: AuthOptions = {}): Promise<UserDoc> {
  const token = BEARER_RE.exec(req.headers.get('authorization') ?? '')?.[1];
  if (!token) throw unauthenticated();

  let decoded: { id: string; tv: number };
  try {
    decoded = verifyToken(token);
  } catch (err) {
    // Only token problems are 401; anything else (missing secret, bug) must surface as 500, not log everyone out.
    if (err instanceof jwt.JsonWebTokenError || err instanceof InvalidTokenError)
      throw unauthenticated();
    throw err;
  }
  if (!ID_RE.test(decoded.id)) throw unauthenticated();

  await connectDb();
  const user = await UserModel.findById(decoded.id).select('-password');
  if (!user) throw unauthenticated();
  if (decoded.tv !== (user.tokenVersion ?? 0))
    throw unauthenticated('Phiên đăng nhập đã bị thu hồi. Vui lòng đăng nhập lại.');

  if (user.mustChangePassword && !opts.allowWhenMustChangePassword) {
    throw new HttpError('MUST_CHANGE_PASSWORD', 'Bạn cần đổi mật khẩu để tiếp tục.');
  }
  return user;
}

export function withAuth(h: AuthHandler, opts?: AuthOptions): Handler {
  return async (req, ctx) => {
    const user = await authenticateRequest(req, opts);
    return h(req, { ...ctx, user, userId: user.id });
  };
}

/** Includes authentication (do not also wrap in withAuth). Put withRateLimit INSIDE h for user-keyed buckets. */
export function withPermission(perm: string, h: AuthHandler, opts?: AuthOptions): Handler {
  if (!KNOWN_PERMISSIONS.has(perm)) throw new Error(`Unknown permission: ${perm}`); // typo = config error at route import
  return withAuth(async (req, ctx) => {
    if (!(await hasPermission(ctx.user.role, perm))) {
      return fail('FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.');
    }
    return h(req, ctx);
  }, opts);
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
