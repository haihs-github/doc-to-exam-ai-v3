// Created by Haihs on 12/11/2026
// GET /api/classes/:id/invite: invite tokens for authorised teachers only (no-store). Source: classController.js getInvite.
import { ok } from '../../../../../src/lib/apiResponse';
import { withClassPermission } from '../../../../../src/lib/classAuth';
import { withErrors } from '../../../../../src/lib/handler';
import { readInvite } from '../../../../../src/services/invite';

export const runtime = 'nodejs';

export const GET = withErrors(
  withClassPermission('invite:read', async (_req, { classDoc }) => {
    const res = ok(await readInvite(classDoc._id));
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }),
);
