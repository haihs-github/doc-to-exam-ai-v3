// Created by Haihs on 12/11/2026
// PATCH /api/classes/:id/students/:userId {fullName}, DELETE: rename / remove a student of this class.
import { withClassPermission } from '../../../../../../src/lib/classAuth';
import { withErrors } from '../../../../../../src/lib/handler';
import { removeMember } from '../../../../../../src/services/memberHandlers';
import { updateStudentName } from '../../../../../../src/services/studentAdmin';

export const runtime = 'nodejs';

export const PATCH = withErrors(withClassPermission('student:update', updateStudentName));
export const DELETE = withErrors(withClassPermission('student:remove', removeMember('student')));
