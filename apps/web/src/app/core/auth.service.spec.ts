// Created by Haihs on 11/11/2026
// Specs for AuthService: startup me-load, stale responses, login/register/changePassword/logoutAll/updateApiKey, window events.
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import type { AuthUser } from '@doc-to-exam/contract';
import { AuthService } from './auth.service';
import { TokenStore } from './token-store';
import { MUST_CHANGE_PASSWORD_EVENT, UNAUTHENTICATED_EVENT } from './auth.interceptor';

const teacher: AuthUser = {
  id: 't1',
  phoneNumber: '0900000001',
  fullName: 'T',
  role: 'teacher',
  mustChangePassword: false,
};
const student: AuthUser = { ...teacher, id: 's1', role: 'student' };
const ok = <T>(data: T) => ({ success: true, data });
const fail = (code: string, status: number) =>
  [
    { success: false, code, message: 'm' },
    { status, statusText: 'x' },
  ] as const;

describe('AuthService', () => {
  let ctl: HttpTestingController;
  let tokens: TokenStore;
  const setup = (token?: string): AuthService => {
    localStorage.clear();
    if (token) localStorage.setItem('auth_token', token);
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    ctl = TestBed.inject(HttpTestingController);
    tokens = TestBed.inject(TokenStore);
    return TestBed.inject(AuthService);
  };
  afterEach(() => {
    ctl.verify();
    localStorage.clear();
  });

  it('without a token: no request, not loading, anonymous', () => {
    const s = setup();
    expect(s.isLoading()).toBe(false);
    expect(s.user()).toBeNull();
    expect(s.isAuthenticated()).toBe(false);
  });

  it('with a token: loads /api/auth/me and exposes role flags', () => {
    const s = setup('tk');
    expect(s.isLoading()).toBe(true);
    ctl.expectOne('/api/auth/me').flush(ok(teacher));
    expect(s.user()).toEqual(teacher);
    expect(s.isLoading()).toBe(false);
    expect(s.isAuthenticated()).toBe(true);
    expect(s.isTeacher()).toBe(true);
    expect(s.isStudent()).toBe(false);
  });

  it('me 401 logs out (token cleared)', () => {
    const s = setup('tk');
    ctl.expectOne('/api/auth/me').flush(...fail('UNAUTHENTICATED', 401));
    expect(tokens.get()).toBeNull();
    expect(s.user()).toBeNull();
    expect(s.isLoading()).toBe(false);
    expect(s.loadError()).toBe('');
  });

  it('me network/5xx error keeps the token, sets loadError; reload() retries and clears it', () => {
    const s = setup('tk');
    ctl.expectOne('/api/auth/me').error(new ProgressEvent('error'));
    expect(tokens.get()).toBe('tk');
    expect(s.loadError()).not.toBe('');
    expect(s.isLoading()).toBe(false);
    expect(s.user()).toBeNull();
    s.reload();
    expect(s.isLoading()).toBe(true);
    expect(s.loadError()).toBe('');
    ctl.expectOne('/api/auth/me').flush(ok(teacher));
    expect(s.user()).toEqual(teacher);
    expect(s.loadError()).toBe('');
  });

  it('two overlapping me loads: only the latest wins', () => {
    const s = setup('tk');
    s.reload();
    const reqs = ctl.match('/api/auth/me');
    expect(reqs.length).toBe(2);
    expect(reqs[0].cancelled).toBe(true);
    reqs[1].flush(ok(student));
    expect(s.user()).toEqual(student);
  });

  it('a me response arriving after logout does not resurrect the user', () => {
    const s = setup('tk');
    s.logout();
    const reqs = ctl.match('/api/auth/me');
    expect(reqs[0].cancelled).toBe(true);
    expect(s.user()).toBeNull();
    expect(s.isLoading()).toBe(false);
    expect(tokens.get()).toBeNull();
  });

  it('login posts to the audience endpoint, stores token and user', async () => {
    const s = setup();
    const p = firstValueFrom(s.login('student', { phoneNumber: '1', password: 'p' }));
    const req = ctl.expectOne('/api/auth/student/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ phoneNumber: '1', password: 'p' });
    req.flush(ok({ token: 'NEW', user: student }));
    expect(((await p) as { token: string }).token).toBe('NEW');
    expect(tokens.get()).toBe('NEW');
    expect(s.user()).toEqual(student);
    expect(s.isStudent()).toBe(true);
  });

  it('login failure leaves state untouched', async () => {
    const s = setup();
    const p = firstValueFrom(s.login('teacher', { phoneNumber: '1', password: 'p' })).catch(
      (e: { code: string }) => e,
    );
    ctl.expectOne('/api/auth/teacher/login').flush(...fail('INVALID_CREDENTIALS', 401));
    expect(((await p) as { code: string }).code).toBe('INVALID_CREDENTIALS');
    expect(s.user()).toBeNull();
    expect(tokens.get()).toBeNull();
  });

  it('register posts to the audience endpoint and applies the result', async () => {
    const s = setup();
    const p = firstValueFrom(
      s.register('teacher', { phoneNumber: '1', fullName: 'T', password: 'p' }),
    );
    const req = ctl.expectOne('/api/auth/teacher/register');
    expect(req.request.method).toBe('POST');
    req.flush(ok({ token: 'R', user: teacher }));
    await p;
    expect(tokens.get()).toBe('R');
    expect(s.user()).toEqual(teacher);
  });

  it('login while a me load is in flight cancels the load (no overwrite)', async () => {
    const s = setup('old');
    const p = firstValueFrom(s.login('teacher', { phoneNumber: '1', password: 'p' }));
    const me = ctl.expectOne('/api/auth/me');
    ctl.expectOne('/api/auth/teacher/login').flush(ok({ token: 'N', user: teacher }));
    await p;
    expect(me.cancelled).toBe(true);
    expect(s.user()).toEqual(teacher);
    expect(s.isLoading()).toBe(false);
  });

  it('changePassword stores the NEW token and clears mustChangePassword', async () => {
    const s = setup('old');
    ctl.expectOne('/api/auth/me').flush(ok({ ...teacher, mustChangePassword: true }));
    const body = { currentPassword: 'a', newPassword: 'b' };
    const p = firstValueFrom(s.changePassword(body));
    const req = ctl.expectOne('/api/auth/change-password');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush(ok({ token: 'NEWTOK', user: teacher }));
    await p;
    expect(tokens.get()).toBe('NEWTOK');
    expect(s.user()?.mustChangePassword).toBe(false);
  });

  it('logoutAll posts then clears local state', async () => {
    const s = setup('tk');
    ctl.expectOne('/api/auth/me').flush(ok(teacher));
    const p = firstValueFrom(s.logoutAll());
    const req = ctl.expectOne('/api/auth/logout-all');
    expect(req.request.method).toBe('POST');
    expect(s.user()).not.toBeNull(); // not cleared before the server confirms
    req.flush(ok(null));
    await p;
    expect(s.user()).toBeNull();
    expect(tokens.get()).toBeNull();
  });

  it('updateApiKey PUTs and updates hasApiKey/apiKeyLast4 from the response', async () => {
    const s = setup('tk');
    ctl.expectOne('/api/auth/me').flush(ok(teacher));
    const p = firstValueFrom(s.updateApiKey('AIza1234'));
    const req = ctl.expectOne('/api/auth/api-key');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ geminiApiKey: 'AIza1234' });
    req.flush(ok({ hasApiKey: true, apiKeyLast4: '1234' }));
    await p;
    expect(s.user()?.hasApiKey).toBe(true);
    expect(s.user()?.apiKeyLast4).toBe('1234');
  });

  it('auth:unauthenticated event logs out; auth:must-change-password flags the user without logout', () => {
    const s = setup('tk');
    ctl.expectOne('/api/auth/me').flush(ok(teacher));
    window.dispatchEvent(new CustomEvent(MUST_CHANGE_PASSWORD_EVENT));
    expect(s.user()?.mustChangePassword).toBe(true);
    expect(tokens.get()).toBe('tk');
    window.dispatchEvent(new CustomEvent(UNAUTHENTICATED_EVENT));
    expect(s.user()).toBeNull();
    expect(s.isAuthenticated()).toBe(false);
  });

  it('never puts the token in loadError', () => {
    const s = setup('SECRET-TOKEN');
    ctl.expectOne('/api/auth/me').flush('x', { status: 500, statusText: 'x' });
    expect(s.loadError()).not.toContain('SECRET-TOKEN');
  });
});
