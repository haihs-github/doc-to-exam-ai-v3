// Created by Haihs on 11/11/2026
// POST /api/auth/student/login (limiters: server/routes/authRoutes.js:33)
import { authRoute, loginHandler } from '../../../../../src/lib/authHandlers';
import { LIMITERS as L } from '../../../../../src/lib/limiters';

export const runtime = 'nodejs';
export const POST = authRoute(
  [L.STUDENT_LOGIN, L.LOGIN_IP_FAIL, L.LOGIN_ACCOUNT, L.LOGIN_PHONE_GLOBAL],
  loginHandler('student'),
);
