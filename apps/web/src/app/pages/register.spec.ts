// Created by Haihs on 11/11/2026
// Specs for the Register page (student + teacher): honeypot, secret key, normalised body, errors, single-flight.
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Subject, of, throwError } from 'rxjs';
import type { AuthUser } from '@doc-to-exam/contract';
import { AuthService } from '../core/auth.service';
import { AlertService } from '../shared/ui/alert.service';
import { Register } from './register';

@Component({ template: 'dummy' })
class Dummy {}

const HP = 'contact_site_url_x'; // DOM name must not be a browser autofill token; the payload field is still `website`

const mk = (over: Partial<AuthUser> = {}): AuthUser => ({
  id: '1',
  phoneNumber: '0912345678',
  fullName: 'Hoàng Thị Tuyến',
  role: 'student',
  mustChangePassword: false,
  ...over,
});

const setup = async (url = '/register', state?: Record<string, unknown>) => {
  const user = signal<AuthUser | null>(null);
  const register = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'register', component: Register, data: { audience: 'student' } },
        { path: 'teacher/register', component: Register, data: { audience: 'teacher' } },
        { path: '**', component: Dummy },
      ]),
      { provide: AuthService, useValue: { user, register } },
    ],
  });
  const alertError = vi.spyOn(TestBed.inject(AlertService), 'error').mockResolvedValue();
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
  const fill = async (teacher = false) => {
    await type('fullName', '  Hoàng   Thị Tuyến ');
    await type('phoneNumber', '0912.345.678');
    await type('password', 'secret-pw1');
    if (teacher) await type('secretKey', ' key-123 ');
  };
  return { user, register, alertError, harness, router, el, input, type, submit, fill };
};

describe('Register (student)', () => {
  it('heading and cross links', async () => {
    const { el } = await setup();
    expect(el.querySelector('h2')?.textContent).toContain('Đăng Ký Tài Khoản Học Sinh');
    expect(el.querySelector('a[href="/login"]')).toBeTruthy();
    expect(el.querySelector('a[href="/teacher/register"]')).toBeTruthy();
    expect(el.querySelector('input[name="secretKey"]')).toBeNull();
  });

  it.each(['/register', '/teacher/register'])(
    'honeypot on %s: hidden, inert, not tabbable, never autofilled',
    async (url) => {
      const { el, input } = await setup(url);
      const hp = input(HP);
      expect(hp.getAttribute('tabindex')).toBe('-1');
      expect(hp.getAttribute('autocomplete')).toBe('off');
      expect(hp.value).toBe('');
      expect(hp.closest('[aria-hidden="true"]')).toBeTruthy();
      expect(hp.closest('[aria-hidden="true"]')!.className).toContain('-left-[9999px]');
      expect(hp.closest('[aria-hidden="true"]')!.hasAttribute('inert')).toBe(true);
      expect(el.querySelectorAll(`input[name="${HP}"]`).length).toBe(1);
    },
  );

  it('input attributes: autocomplete new-password, tel/numeric phone', async () => {
    const { input } = await setup();
    expect(input('password').getAttribute('autocomplete')).toBe('new-password');
    expect(input('phoneNumber').getAttribute('autocomplete')).toBe('tel');
    expect(input('phoneNumber').getAttribute('inputmode')).toBe('numeric');
    expect(input('phoneNumber').type).toBe('tel');
    expect(input('fullName').getAttribute('autocomplete')).toBe('name');
    expect(input('fullName').maxLength).toBe(255);
  });

  it('empty submit: errors in screen order, first field focused, no API call', async () => {
    const s = await setup();
    await s.submit();
    const msgs = [...s.el.querySelectorAll('[role="alert"]')].map((a) => a.textContent?.trim());
    expect(msgs).toEqual([
      'Vui lòng nhập họ và tên.',
      'Vui lòng nhập số điện thoại.',
      'Mật khẩu phải có ít nhất 8 ký tự.',
    ]);
    expect(document.activeElement).toBe(s.input('fullName'));
    expect(s.register).not.toHaveBeenCalled();
  });

  it('sends normalised phone/name + empty website, then goes to the role home', async () => {
    const s = await setup();
    s.register.mockReturnValue(of({ token: 't', user: mk() }));
    await s.fill();
    await s.submit();
    expect(s.register).toHaveBeenCalledWith('student', {
      phoneNumber: '0912345678',
      fullName: 'Hoàng Thị Tuyến',
      password: 'secret-pw1',
      website: '',
    });
    expect(s.router.url).toBe('/sittings');
  });

  it('a filled honeypot is sent as typed (the server rejects it)', async () => {
    const s = await setup();
    s.register.mockReturnValue(of({ token: 't', user: mk() }));
    await s.fill();
    await s.type(HP, 'http://spam');
    await s.submit();
    expect(s.register.mock.calls[0][1].website).toBe('http://spam');
  });

  it('blocks a double submit', async () => {
    const s = await setup();
    const pending = new Subject<unknown>();
    s.register.mockReturnValue(pending);
    await s.fill();
    await s.submit();
    await s.submit();
    expect(s.register).toHaveBeenCalledTimes(1);
    const btn = s.el.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toContain('Đang Tạo Tài Khoản...');
  });

  it('server VALIDATION on geminiApiKey shows under that field (no popup)', async () => {
    const s = await setup('/teacher/register');
    s.register.mockReturnValue(
      throwError(() => ({
        success: false,
        code: 'VALIDATION',
        field: 'geminiApiKey',
        message: 'API key không hợp lệ.',
        status: 400,
      })),
    );
    await s.fill(true);
    await s.type('geminiApiKey', 'AIza-bad');
    await s.submit();
    expect(s.el.querySelector('[role="alert"]')?.textContent).toContain('API key không hợp lệ.');
    expect(s.input('geminiApiKey').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(s.input('geminiApiKey'));
    expect(s.alertError).not.toHaveBeenCalled();
  });

  it('server VALIDATION with a field marks and focuses it; other errors use the popup', async () => {
    const s = await setup();
    s.register.mockReturnValue(
      throwError(() => ({
        success: false,
        code: 'VALIDATION',
        field: 'phoneNumber',
        message: 'Số điện thoại không hợp lệ.',
        status: 400,
      })),
    );
    await s.fill();
    await s.submit();
    expect(s.el.querySelector('[role="alert"]')?.textContent).toContain(
      'Số điện thoại không hợp lệ.',
    );
    expect(document.activeElement).toBe(s.input('phoneNumber'));
    expect(s.alertError).not.toHaveBeenCalled();

    s.register.mockReturnValue(
      throwError(() => ({
        success: false,
        code: 'PHONE_TAKEN',
        message: 'Số điện thoại đã được đăng ký.',
        status: 409,
      })),
    );
    await s.submit();
    expect(s.alertError).toHaveBeenCalledWith('Số điện thoại đã được đăng ký.');
  });

  it('non-contract errors never leak', async () => {
    const s = await setup();
    s.register.mockReturnValue(throwError(() => new Error('stack at /srv/x.js')));
    await s.fill();
    await s.submit();
    expect(s.alertError).toHaveBeenCalledWith('Có lỗi xảy ra. Vui lòng thử lại!');
  });

  it('redirects an authenticated user (only when user() is set)', async () => {
    const s = await setup();
    expect(s.router.url).toBe('/register');
    s.user.set(mk({ mustChangePassword: true }));
    await s.harness.fixture.whenStable();
    expect(s.router.url).toBe('/change-password');
  });
});

describe('Register (teacher)', () => {
  it('shows secret key + optional Gemini key, no honeypot; heading', async () => {
    const { el, input } = await setup('/teacher/register');
    expect(el.querySelector('h2')?.textContent).toContain('Đăng Ký Tài Khoản Giáo Viên');
    expect(input('secretKey')).toBeTruthy();
    expect(input('secretKey').type).toBe('password');
    expect(input('geminiApiKey')).toBeTruthy();
    expect(el.querySelector('a[href="/teacher/login"]')).toBeTruthy();
  });

  it('requires the secret key', async () => {
    const s = await setup('/teacher/register');
    await s.type('fullName', 'Hoàng Thị Tuyến');
    await s.type('phoneNumber', '0912345678');
    await s.type('password', 'secret-pw1');
    await s.submit();
    expect(s.el.querySelector('[role="alert"]')?.textContent).toContain(
      'Vui lòng nhập mã bí mật giáo viên.',
    );
    expect(document.activeElement).toBe(s.input('secretKey'));
    expect(s.register).not.toHaveBeenCalled();
  });

  it('sends secretKey (trimmed) on the teacher endpoint, geminiApiKey only when filled', async () => {
    const s = await setup('/teacher/register');
    s.register.mockReturnValue(of({ token: 't', user: mk({ role: 'teacher' }) }));
    await s.fill(true);
    await s.submit();
    expect(s.register).toHaveBeenCalledWith('teacher', {
      phoneNumber: '0912345678',
      fullName: 'Hoàng Thị Tuyến',
      password: 'secret-pw1',
      secretKey: 'key-123',
      website: '',
    });
    expect(s.router.url).toBe('/');
  });

  it('a filled honeypot is sent as `website` for teachers too', async () => {
    const s = await setup('/teacher/register');
    s.register.mockReturnValue(of({ token: 't', user: mk({ role: 'teacher' }) }));
    await s.fill(true);
    await s.type(HP, 'http://spam');
    await s.submit();
    expect(s.register.mock.calls[0][1].website).toBe('http://spam');
  });

  it('sends geminiApiKey (trimmed) when filled', async () => {
    const s = await setup('/teacher/register');
    s.register.mockReturnValue(of({ token: 't', user: mk({ role: 'teacher' }) }));
    await s.fill(true);
    await s.type('geminiApiKey', ' AIza-xyz ');
    await s.submit();
    expect(s.register.mock.calls[0][1].geminiApiKey).toBe('AIza-xyz');
  });
});
