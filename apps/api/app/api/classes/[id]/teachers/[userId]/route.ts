// Created by Haihs on 12/11/2026
// DELETE /api/classes/:id/teachers/:userId: remove a teacher (never yourself, never the last one).
import { withClassPermission } from '../../../../../../src/lib/classAuth';
import { withErrors } from '../../../../../../src/lib/handler';
import { removeMember } from '../../../../../../src/services/memberHandlers';

export const runtime = 'nodejs';

export const DELETE = withErrors(withClassPermission('teacher:remove', removeMember('teacher')));
