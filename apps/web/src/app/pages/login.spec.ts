// Created by Haihs on 11/11/2026
// Specs for the Login page (student + teacher audience): validation, focus, single-flight submit, errors, redirects.
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Subject, of, throwError } from 'rxjs';
import type { AuthUser } from '@doc-to-exam/contract';
import { AuthService } from '../core/auth.service';
import { AlertService } from '../shared/ui/alert.service';
import { Login } from './login';

@Component({ template: 'dummy' })
class Dummy {}

const mk = (over: Partial<AuthUser> = {}): AuthUser => ({
  id: '1',
  phoneNumber: '0912345678',
  fullName: 'Nguyễn A',
  role: 'student',
  mustChangePassword: false,
  ...over,
});

const setup = async (url = '/login', state?: Record<string, unknown>) => {
  const user = signal<AuthUser | null>(null);
  const login = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'login', component: Login, data: { audience: 'student' } },
        { path: 'teacher/login', component: Login, data: { audience: 'teacher' } },
        { path: 'register', component: Dummy },
        { path: 'teacher/register', component: Dummy },
        { path: '**', component: Dummy },
      ]),
      { provide: AuthService, useValue: { user, login } },
    ],
  });
  const alert = TestBed.inject(AlertService);
  const alertError = vi.spyOn(alert, 'error').mockResolvedValue();
  const harness = await RouterTestingHarness.create();
  const router = TestBed.inject(Router);
  await router.navigateByUrl(url, { state });
  await harness.fixture.whenStable();
  const el = harness.routeNativeElement as HTMLElement;
  const input = (name: string) => el.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
  const type = async (name: string, v: string) => {
    const i = input(name);
    i.value = v;
    i.dispatchEvent(new Event('input'));
    await harness.fixture.whenStable();
  };
  const submit = async () => {
    el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await harness.fixture.whenStable();
  };
  return { user, login, alertError, harness, router, el, input, type, submit };
};

const fill = async (s: Awaited<ReturnType<typeof setup>>) => {
  await s.type('phoneNumber', '091 234 5678');
  await s.type('password', 'secret-pw');
};

describe('Login', () => {
  it('student vs teacher headings and cross links', async () => {
    const s = await setup('/login');
    expect(s.el.querySelector('h2')?.textContent).toContain('Đăng Nhập Học Sinh');
    expect(s.el.querySelector('a[href="/register"]')).toBeTruthy();
    expect(s.el.querySelector('a[href="/teacher/login"]')).toBeTruthy();
    TestBed.resetTestingModule();
    const t = await setup('/teacher/login');
    expect(t.el.querySelector('h2')?.textContent).toContain('Cổng Đăng Nhập Giáo Viên');
    expect(t.el.querySelector('a[href="/teacher/register"]')).toBeTruthy();
    expect(t.el.querySelector('a[href="/login"]')).toBeTruthy();
  });

  it('input attributes: tel/numeric, autocomplete tel and current-password', async () => {
    const { input } = await setup();
    expect(input('phoneNumber').type).toBe('tel');
    expect(input('phoneNumber').getAttribute('inputmode')).toBe('numeric');
    expect(input('phoneNumber').getAttribute('autocomplete')).toBe('tel');
    expect(input('password').getAttribute('autocomplete')).toBe('current-password');
  });

  it('empty submit shows both errors, focuses the first, does not call the API', async () => {
    const s = await setup();
    await s.submit();
    const alerts = [...s.el.querySelectorAll('[role="alert"]')].map((a) => a.textContent?.trim());
    expect(alerts).toEqual(['Vui lòng nhập số điện thoại.', 'Vui lòng nhập mật khẩu.']);
    expect(document.activeElement).toBe(s.input('phoneNumber'));
    expect(s.login).not.toHaveBeenCalled();
  });

  it('sends the normalised phone and navigates by role (student -> /sittings)', async () => {
    const s = await setup();
    s.login.mockReturnValue(of({ token: 't', user: mk() }));
    await fill(s);
    await s.submit();
    expect(s.login).toHaveBeenCalledWith('student', {
      phoneNumber: '0912345678',
      password: 'secret-pw',
    });
    expect(s.router.url).toBe('/sittings');
  });

  it('teacher audience logs in on the teacher endpoint and goes home', async () => {
    const s = await setup('/teacher/login');
    s.login.mockReturnValue(of({ token: 't', user: mk({ role: 'teacher' }) }));
    await fill(s);
    await s.submit();
    expect(s.login).toHaveBeenCalledWith('teacher', expect.anything());
    expect(s.router.url).toBe('/');
  });

  it('mustChangePassword goes to /change-password; state.from is honoured otherwise', async () => {
    const a = await setup();
    a.login.mockReturnValue(of({ token: 't', user: mk({ mustChangePassword: true }) }));
    await fill(a);
    await a.submit();
    expect(a.router.url).toBe('/change-password');
    TestBed.resetTestingModule();
    const b = await setup('/login', { from: '/ca/abc' });
    b.login.mockReturnValue(of({ token: 't', user: mk() }));
    await fill(b);
    await b.submit();
    expect(b.router.url).toBe('/ca/abc');
  });

  it('blocks a double submit and disables the button while pending', async () => {
    const s = await setup();
    const pending = new Subject<unknown>();
    s.login.mockReturnValue(pending);
    await fill(s);
    await s.submit();
    await s.submit();
    expect(s.login).toHaveBeenCalledTimes(1);
    const btn = s.el.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toContain('Đang Đăng Nhập...');
    pending.error({ success: false, code: 'UNAUTHENTICATED', message: 'Sai', status: 401 });
    await s.harness.fixture.whenStable();
    expect(btn.disabled).toBe(false);
  });

  it('401 shows the Vietnamese server message via alert', async () => {
    const s = await setup();
    s.login.mockReturnValue(
      throwError(() => ({
        success: false,
        code: 'UNAUTHENTICATED',
        message: 'Số điện thoại hoặc mật khẩu không đúng.',
        status: 401,
      })),
    );
    await fill(s);
    await s.submit();
    expect(s.alertError).toHaveBeenCalledWith('Số điện thoại hoặc mật khẩu không đúng.');
  });

  it('a non-contract error never leaks its text or stack', async () => {
    const s = await setup();
    s.login.mockReturnValue(throwError(() => new Error('SELECT * FROM users at /srv/app.js:1')));
    await fill(s);
    await s.submit();
    expect(s.alertError).toHaveBeenCalledWith('Có lỗi xảy ra. Vui lòng thử lại!');
  });

  it('server VALIDATION with a field marks and focuses that field, no popup', async () => {
    const s = await setup();
    s.login.mockReturnValue(
      throwError(() => ({
        success: false,
        code: 'VALIDATION',
        field: 'password',
        message: 'Mật khẩu không hợp lệ.',
        status: 400,
      })),
    );
    await fill(s);
    await s.submit();
    expect(s.el.querySelector('[role="alert"]')?.textContent).toContain('Mật khẩu không hợp lệ.');
    expect(document.activeElement).toBe(s.input('password'));
    expect(s.alertError).not.toHaveBeenCalled();
  });

  it('typing re-validates shown errors (error clears when fixed)', async () => {
    const s = await setup();
    await s.submit();
    await s.type('phoneNumber', '0912345678');
    expect([...s.el.querySelectorAll('[role="alert"]')].map((a) => a.textContent?.trim())).toEqual([
      'Vui lòng nhập mật khẩu.',
    ]);
  });

  it('an already authenticated user (user() set) is redirected; nobody is redirected without a user', async () => {
    const s = await setup();
    expect(s.router.url).toBe('/login');
    s.user.set(mk({ role: 'teacher' }));
    await s.harness.fixture.whenStable();
    expect(s.router.url).toBe('/');
  });
});
