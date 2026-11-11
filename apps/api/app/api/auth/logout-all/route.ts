// Created by Haihs on 11/11/2026
// POST /api/auth/logout-all (source authController.js logoutAll; authRoutes.js:55)
import { ok } from '../../../../src/lib/apiResponse';
import { withPermission } from '../../../../src/lib/auth';
import { withErrors } from '../../../../src/lib/handler';
import { UserModel } from '../../../../src/models/User';

export const runtime = 'nodejs';
export const POST = withErrors(
  withPermission(
    'account:logoutAll',
    async (_req, ctx) => {
      // Atomic $inc: concurrent logouts/changes never lose an increment; this token dies too (no new one is issued).
      await UserModel.updateOne({ _id: ctx.userId }, { $inc: { tokenVersion: 1 } });
      return ok(null);
    },
    { allowWhenMustChangePassword: true },
  ),
);
