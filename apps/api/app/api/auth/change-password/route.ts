// Created by Haihs on 11/11/2026
// POST /api/auth/change-password (source authController.js changePassword; authRoutes.js:56)
import type { AuthResult, ChangePasswordBody } from '@doc-to-exam/contract';
import { ok } from '../../../../src/lib/apiResponse';
import { withPermission } from '../../../../src/lib/auth';
import { MAX_LOGIN_PASSWORD } from '../../../../src/lib/authValidation';
import { HttpError, readJson, withErrors } from '../../../../src/lib/handler';
import { signToken } from '../../../../src/lib/jwt';
import { LIMITERS } from '../../../../src/lib/limiters';
import {
  assertPasswordPolicy,
  comparePassword,
  hashPassword,
} from '../../../../src/lib/passwordHash';
import { withRateLimit } from '../../../../src/lib/rateLimit';
import { UserModel } from '../../../../src/models/User';

export const runtime = 'nodejs';

const bad = (field: string, message: string) => new HttpError('VALIDATION', message, { field });

// Limiter INSIDE auth: CHANGE_PASSWORD is keyed by ctx.userId and counts only 4xx (wrong current password).
export const POST = withErrors(
  withPermission(
    'account:changePassword',
    withRateLimit([LIMITERS.CHANGE_PASSWORD], async (req, ctx) => {
      const body = (await readJson(req, 4096)) as Partial<ChangePasswordBody> | null;
      const { currentPassword, newPassword } = body ?? {};
      if (
        typeof currentPassword !== 'string' ||
        !currentPassword ||
        currentPassword.length > MAX_LOGIN_PASSWORD
      )
        throw bad('currentPassword', 'Vui lòng nhập mật khẩu hiện tại.');
      try {
        assertPasswordPolicy(newPassword as string);
      } catch (e) {
        if (e instanceof HttpError && e.code === 'VALIDATION') throw bad('newPassword', e.message);
        throw e;
      }
      if (newPassword === currentPassword)
        throw bad('newPassword', 'Mật khẩu mới phải khác mật khẩu hiện tại.');

      const user = await UserModel.findById(ctx.userId); // ctx.user has no password hash
      if (!user) throw new HttpError('UNAUTHENTICATED', 'Phiên đăng nhập không hợp lệ.');
      if (!(await comparePassword(currentPassword, user.password)))
        throw bad('currentPassword', 'Mật khẩu hiện tại không chính xác.'); // 400, not 401: the client must not drop the session

      const hash = await hashPassword(newPassword as string);
      // Conditional on the tokenVersion we read: a concurrent change/logout-all matches nothing, so it is never applied twice.
      const updated = await UserModel.findOneAndUpdate(
        { _id: user._id, tokenVersion: user.tokenVersion ?? 0 },
        { $set: { password: hash, mustChangePassword: false }, $inc: { tokenVersion: 1 } },
        { returnDocument: 'after' },
      );
      if (!updated)
        throw new HttpError(
          'UNAUTHENTICATED',
          'Phiên đăng nhập đã bị thu hồi. Vui lòng đăng nhập lại.',
        );
      return ok<AuthResult>(
        {
          token: signToken({ id: updated.id, tokenVersion: updated.tokenVersion }),
          user: updated.toAuthUser(),
        },
        { message: 'Đổi mật khẩu thành công!' },
      );
    }),
    { allowWhenMustChangePassword: true },
  ),
);
