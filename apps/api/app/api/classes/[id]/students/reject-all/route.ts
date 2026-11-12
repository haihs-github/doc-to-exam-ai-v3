// Created by Haihs on 12/11/2026
// POST /api/classes/:id/students/reject-all: drop every pending student request.
import { withClassPermission } from '../../../../../../src/lib/classAuth';
import { withErrors } from '../../../../../../src/lib/handler';
import { rejectAllStudents } from '../../../../../../src/services/memberHandlers';

export const runtime = 'nodejs';

export const POST = withErrors(withClassPermission('student:remove', rejectAllStudents));
