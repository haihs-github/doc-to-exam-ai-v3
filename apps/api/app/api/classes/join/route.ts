// Created by Haihs on 12/11/2026
// POST /api/classes/join {token}: request to join a class by invite token (pending). Every failure is one 404 INVITE_INVALID. Source: joinClass.
import { fail, ok } from '../../../../src/lib/apiResponse';
import { withPermission } from '../../../../src/lib/auth';
import { toClassDto } from '../../../../src/lib/classDto';
import { readJson, withErrors } from '../../../../src/lib/handler';
import { LIMITERS } from '../../../../src/lib/limiters';
import { withRateLimit } from '../../../../src/lib/rateLimit';
import { ClassMemberModel } from '../../../../src/models/ClassMember';
import { findClassByToken, INVITE_TOKEN_RE, isKind } from '../../../../src/services/invite';

export const runtime = 'nodejs';

const invalid = () => fail('INVITE_INVALID', 'Link mời không hợp lệ hoặc đã hết hiệu lực.');

// IP limiters outside auth, the per-user one inside (keyed by ctx.userId), same order as the source route.
export const POST = withErrors(
  withRateLimit(
    [LIMITERS.STUDENT_API, LIMITERS.CLASS_JOIN_IP],
    withPermission(
      'class:join',
      withRateLimit([LIMITERS.CLASS_JOIN], async (req, ctx) => {
        const raw = await readJson(req, 1024).catch(() => null);
        const token =
          raw && typeof raw === 'object' ? (raw as { token?: unknown }).token : undefined;
        if (typeof token !== 'string' || !INVITE_TOKEN_RE.test(token)) return invalid();
        const kind = ctx.user.role; // the token kind follows the caller's role
        if (!isKind(kind)) return invalid();
        const cls = await findClassByToken(token, kind);
        if (!cls) return invalid();

        const key = { classId: cls._id, userId: ctx.user._id };
        const request = () =>
          ClassMemberModel.updateOne(
            key,
            {
              $setOnInsert: {
                memberRole: kind,
                status: 'pending',
                source: 'invite',
                addedBy: null,
                requestedAt: new Date(),
              },
            },
            { upsert: true },
          );
        try {
          await request();
        } catch (err) {
          if ((err as { code?: unknown }).code !== 11000) throw err;
          await request(); // two parallel upserts: the second now matches the inserted row
        }
        const member = await ClassMemberModel.findOne(key).select('status').lean(); // approved stays approved
        return ok(toClassDto(cls, { membershipStatus: member?.status }));
      }),
    ),
  ),
);
