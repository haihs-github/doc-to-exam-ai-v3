// Created by Haihs on 11/11/2026
// Specs for pure auth routing (ported from client/tests/authRules.test.js decideRoute/postLoginPath).
import type { AuthUser } from '@doc-to-exam/contract';
import { decideRoute, postLoginPath, homePathForRole } from './auth-routing';

const u = (role: AuthUser['role'], mustChangePassword = false): AuthUser => ({
  id: '1',
  phoneNumber: '0912345678',
  fullName: 'A B',
  role,
  mustChangePassword,
});

describe('decideRoute', () => {
  it('chưa đăng nhập về cổng đúng và giữ from', () => {
    expect(decideRoute({ user: null, roles: ['teacher'], path: '/results' })).toEqual({
      kind: 'redirect',
      to: '/teacher/login',
      state: { from: '/results' },
    });
    expect(decideRoute({ user: null, roles: ['student'], path: '/classes' })).toEqual({
      kind: 'redirect',
      to: '/login',
      state: { from: '/classes' },
    });
    expect(decideRoute({ user: null, path: '/join/x' })).toEqual({
      kind: 'redirect',
      to: '/login',
      state: { from: '/join/x' },
    });
    expect(decideRoute({ user: null, audience: 'teacher' })).toMatchObject({
      to: '/teacher/login',
    });
  });

  it('mustChangePassword chỉ cho vào /change-password, ưu tiên hơn kiểm vai trò', () => {
    const user = u('student', true);
    expect(decideRoute({ user, roles: ['student'], path: '/classes' })).toEqual({
      kind: 'redirect',
      to: '/change-password',
    });
    expect(decideRoute({ user, roles: ['teacher'], path: '/results' })).toEqual({
      kind: 'redirect',
      to: '/change-password',
    });
    expect(decideRoute({ user, path: '/change-password' })).toEqual({ kind: 'allow' });
  });

  it('sai vai trò về "/", đúng vai trò hoặc route mở thì cho vào', () => {
    expect(decideRoute({ user: u('student'), roles: ['teacher'] })).toEqual({
      kind: 'redirect',
      to: '/',
    });
    expect(decideRoute({ user: u('teacher'), roles: ['student'] })).toEqual({
      kind: 'redirect',
      to: '/',
    });
    expect(decideRoute({ user: u('teacher'), roles: ['teacher'] })).toEqual({ kind: 'allow' });
    expect(decideRoute({ user: u('student') })).toEqual({ kind: 'allow' });
  });
});

describe('postLoginPath', () => {
  it('phân luồng theo vai trò, mustChangePassword và trang đang định vào', () => {
    expect(homePathForRole('teacher')).toBe('/');
    expect(homePathForRole('student')).toBe('/sittings');
    expect(postLoginPath(u('teacher'))).toBe('/');
    expect(postLoginPath(u('student'))).toBe('/sittings');
    expect(postLoginPath(u('student'), '/')).toBe('/sittings');
    expect(postLoginPath(u('student'), '/join/abc')).toBe('/join/abc');
    expect(postLoginPath(u('student', true), '/join/abc')).toBe('/change-password');
  });
});
