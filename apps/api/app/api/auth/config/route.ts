// Created by Haihs on 23/11/2026
// GET /api/auth/config: public flags for the register page (whether the teacher secret code is asked).
import { ok } from '../../../../src/lib/apiResponse';
import { loadEnv } from '../../../../src/lib/env';
import { withErrors } from '../../../../src/lib/handler';

export const runtime = 'nodejs';
export const GET = withErrors(async () => ok({ teacherSecretRequired: loadEnv().enableTeacherSecret }));
