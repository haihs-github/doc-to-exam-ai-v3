// Created by Haihs on 12/11/2026
// POST /api/classes/:id/invite/:kind/rotate: replace the token atomically (old one stops working). Source: rotateInvite.
import { ok } from '../../../../../../../src/lib/apiResponse';
import { withClassPermission } from '../../../../../../../src/lib/classAuth';
import { HttpError, withErrors } from '../../../../../../../src/lib/handler';
import { isKind, readInvite, rotateToken } from '../../../../../../../src/services/invite';

export const runtime = 'nodejs';

export const POST = withErrors(
  withClassPermission('invite:manage', async (_req, { classDoc, params }) => {
    const kind = params.kind;
    if (!isKind(kind))
      throw new HttpError('VALIDATION', 'kind phải là student hoặc teacher.', { field: 'kind' });
    await rotateToken(classDoc._id, kind);
    const res = ok(await readInvite(classDoc._id));
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }),
);
