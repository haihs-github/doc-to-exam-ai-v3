// Created by Haihs on 12/11/2026
// PATCH /api/classes/:id/invite/:kind {enabled}: turn a link on/off. Source: setInviteEnabled.
import { ok } from '../../../../../../src/lib/apiResponse';
import { withClassPermission } from '../../../../../../src/lib/classAuth';
import { HttpError, readJson, withErrors } from '../../../../../../src/lib/handler';
import { isKind, readInvite, setEnabled } from '../../../../../../src/services/invite';

export const runtime = 'nodejs';

export const PATCH = withErrors(
  withClassPermission('invite:manage', async (req, { classDoc, params }) => {
    const kind = params.kind;
    if (!isKind(kind))
      throw new HttpError('VALIDATION', 'kind phải là student hoặc teacher.', { field: 'kind' });
    const body = (await readJson(req, 1024)) as { enabled?: unknown } | null;
    const enabled = body && typeof body === 'object' ? body.enabled : undefined;
    if (typeof enabled !== 'boolean')
      throw new HttpError('VALIDATION', 'enabled phải là true hoặc false.', { field: 'enabled' });
    await setEnabled(classDoc._id, kind, enabled);
    const res = ok(await readInvite(classDoc._id));
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }),
);
