// Created by Haihs on 11/11/2026
// Specs for the ChangePassword page: validation, single-flight, forced vs voluntary flow, logout-all with confirm.
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Subject, of, throwError } from 'rxjs';
import type { AuthUser } from '@doc-to-exam/contract';
import { AuthService } from '../core/auth.service';
import { AlertService } from '../shared/ui/alert.service';
import { ConfirmService } from '../shared/ui/confirm-modal';
import { ChangePassword } from './change-password';

@Component({ template: 'dummy' })
class Dummy {}

const mk = (over: Partial<AuthUser> = {}): AuthUser => ({
  id: '1',
  phoneNumber: '0912345678',
  fullName: 'Nguyễn A',
  role: 'student',
  mustChangePassword: true,
  ...over,
});

const setup = async (u: AuthUser = mk()) => {
  const user = signal<AuthUser | null>(u);
  const changePassword = vi.fn();
  const logoutAll = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'change-password', component: ChangePassword },
        { path: '**', component: Dummy },
      ]),
      { provide: AuthService, useValue: { user, changePassword, logoutAll } },
    ],
  });
  const alert = TestBed.inject(AlertService);
  const alertError = vi.spyOn(alert, 'error').mockResolvedValue();
  const alertSuccess = vi.spyOn(alert, 'success').mockResolvedValue();
  const confirm = vi.spyOn(TestBed.inject(ConfirmService), 'confirm').mockResolvedValue(true);
  const harness = await RouterTestingHarness.create();
  const router = TestBed.inject(Router);
  await router.navigateByUrl('/change-password');
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
  const fill = async () => {
    await type('currentPassword', 'old-password');
    await type('newPassword', 'new-password1');
    await type('confirmPassword', 'new-password1');
  };
  return {
    user,
    changePassword,
    logoutAll,
    alertError,
    alertSuccess,
    confirm,
    harness,
    router,
    el,
    input,
    type,
    submit,
    fill,
  };
};

describe('ChangePassword', () => {
  it('autocomplete: current-password then new-password x2', async () => {
    const { input } = await setup();
    expect(input('currentPassword').getAttribute('autocomplete')).toBe('current-password');
    expect(input('newPassword').getAttribute('autocomplete')).toBe('new-password');
    expect(input('confirmPassword').getAttribute('autocomplete')).toBe('new-password');
  });

  it('forced banner only when mustChangePassword', async () => {
    const a = await setup(mk());
    expect(a.el.textContent).toContain('Bạn cần đổi mật khẩu để tiếp tục.');
    TestBed.resetTestingModule();
    const b = await setup(mk({ mustChangePassword: false }));
    expect(b.el.textContent).not.toContain('Bạn cần đổi mật khẩu để tiếp tục.');
  });

  it('empty submit: three errors, first focused, no API call', async () => {
    const s = await setup();
    await s.submit();
    expect([...s.el.querySelectorAll('[role="alert"]')].map((a) => a.textContent?.trim())).toEqual([
      'Vui lòng nhập mật khẩu hiện tại.',
      'Mật khẩu phải có ít nhất 8 ký tự.',
      'Vui lòng nhập lại mật khẩu mới.',
    ]);
    expect(document.activeElement).toBe(s.input('currentPassword'));
    expect(s.changePassword).not.toHaveBeenCalled();
  });

  it('mismatching confirmation is a field error', async () => {
    const s = await setup();
    await s.fill();
    await s.type('confirmPassword', 'different-1');
    await s.submit();
    expect(s.el.querySelector('[role="alert"]')?.textContent).toContain(
      'Mật khẩu nhập lại không khớp.',
    );
    expect(document.activeElement).toBe(s.input('confirmPassword'));
  });

  it('forced: sends {currentPassword,newPassword} and goes to the role home', async () => {
    const s = await setup();
    s.changePassword.mockReturnValue(of({ token: 't2', user: mk({ mustChangePassword: false }) }));
    await s.fill();
    await s.submit();
    expect(s.changePassword).toHaveBeenCalledWith({
      currentPassword: 'old-password',
      newPassword: 'new-password1',
    });
    expect(s.router.url).toBe('/sittings');
    expect(s.alertSuccess).not.toHaveBeenCalled();
  });

  it('voluntary: stays and shows the success popup', async () => {
    const s = await setup(mk({ mustChangePassword: false }));
    s.changePassword.mockReturnValue(of({ token: 't2', user: mk({ mustChangePassword: false }) }));
    await s.fill();
    await s.submit();
    expect(s.router.url).toBe('/change-password');
    expect(s.alertSuccess).toHaveBeenCalledWith(
      'Đã đổi mật khẩu. Các thiết bị khác phải đăng nhập lại.',
    );
  });

  it('blocks a double submit', async () => {
    const s = await setup();
    s.changePassword.mockReturnValue(new Subject());
    await s.fill();
    await s.submit();
    await s.submit();
    expect(s.changePassword).toHaveBeenCalledTimes(1);
    const btn = s.el.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toContain('Đang xử lý...');
  });

  it('server VALIDATION field -> that field + focus; other error -> popup via errorMessage', async () => {
    const s = await setup();
    s.changePassword.mockReturnValue(
      throwError(() => ({
        success: false,
        code: 'VALIDATION',
        field: 'currentPassword',
        message: 'Mật khẩu hiện tại không đúng.',
        status: 400,
      })),
    );
    await s.fill();
    await s.submit();
    expect(s.el.querySelector('[role="alert"]')?.textContent).toContain(
      'Mật khẩu hiện tại không đúng.',
    );
    expect(document.activeElement).toBe(s.input('currentPassword'));
    s.changePassword.mockReturnValue(throwError(() => new Error('stack /srv/x')));
    await s.submit();
    expect(s.alertError).toHaveBeenCalledWith('Có lỗi xảy ra. Vui lòng thử lại!');
  });

  describe('logout everywhere', () => {
    const click = async (s: Awaited<ReturnType<typeof setup>>) => {
      const btn = [...s.el.querySelectorAll('button')].find((b) =>
        b.textContent?.includes('Đăng xuất mọi thiết bị'),
      )!;
      btn.click();
      await s.harness.fixture.whenStable();
    };
    it('asks for confirmation; cancel does nothing', async () => {
      const s = await setup(mk({ mustChangePassword: false }));
      s.confirm.mockResolvedValue(false);
      await click(s);
      expect(s.confirm).toHaveBeenCalled();
      expect(s.logoutAll).not.toHaveBeenCalled();
    });
    it.each([
      ['student', '/login'],
      ['teacher', '/teacher/login'],
    ] as const)('confirmed: %s -> %s', async (role, to) => {
      const s = await setup(mk({ role, mustChangePassword: false }));
      s.logoutAll.mockReturnValue(of(undefined));
      await click(s);
      expect(s.logoutAll).toHaveBeenCalledTimes(1);
      expect(s.router.url).toBe(to);
    });
    it('failure shows the generic popup', async () => {
      const s = await setup(mk({ mustChangePassword: false }));
      s.logoutAll.mockReturnValue(
        throwError(() => ({
          success: false,
          code: 'INTERNAL',
          message: 'Không đăng xuất được.',
          status: 500,
        })),
      );
      await click(s);
      expect(s.alertError).toHaveBeenCalledWith('Không đăng xuất được.');
      expect(s.router.url).toBe('/change-password');
    });
  });
});
