// Created by Haihs on 11/11/2026
// Pure route decisions by role / mustChangePassword (port of client authRouting.js; no Angular imports).
import type { AuthUser, UserRole } from '@doc-to-exam/contract';

export const TEACHER_HOME = '/';
export const STUDENT_HOME = '/sittings';
export const CHANGE_PASSWORD_PATH = '/change-password';
export const TEACHER_LOGIN_PATH = '/teacher/login';
export const STUDENT_LOGIN_PATH = '/login';

export type RouteDecision = { kind: 'allow' } | { kind: 'redirect'; to: string; state?: unknown };

export const homePathForRole = (role?: UserRole): string =>
  role === 'student' ? STUDENT_HOME : TEACHER_HOME;

/** Order: not logged in -> mustChangePassword (only /change-password allowed) -> wrong role. */
export const decideRoute = (input: {
  user: AuthUser | null;
  roles?: UserRole[];
  audience?: 'teacher' | 'student';
  path?: string; // current path: avoids a redirect loop on /change-password (source had pathname)
}): RouteDecision => {
  const { user, roles, audience, path } = input;
  if (!user) {
    const teacher = audience
      ? audience === 'teacher'
      : roles?.length === 1 && roles[0] === 'teacher';
    return {
      kind: 'redirect',
      to: teacher ? TEACHER_LOGIN_PATH : STUDENT_LOGIN_PATH,
      state: { from: path },
    };
  }
  if (user.mustChangePassword)
    return path === CHANGE_PASSWORD_PATH ? { kind: 'allow' } : { kind: 'redirect', to: CHANGE_PASSWORD_PATH };
  if (roles && !roles.includes(user.role)) return { kind: 'redirect', to: '/' };
  return { kind: 'allow' };
};

/** After login: forced password change first; else the intended page (if not '/'), else the role home. */
export const postLoginPath = (user: AuthUser, from?: string): string => {
  if (user.mustChangePassword) return CHANGE_PASSWORD_PATH;
  return from && from !== '/' ? from : homePathForRole(user.role);
};
