// Created by Haihs on 11/11/2026
// Specs for <app-api-key-modal>: teacher-only, event-driven, no prefill, save/clear flows, focus/Esc/stacking.
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Subject, of, throwError } from 'rxjs';
import type { ApiKeyState, AuthUser } from '@doc-to-exam/contract';
import { AuthService } from '../../core/auth.service';
import { AlertHost } from './alert-modal';
import { AlertService } from './alert.service';
import { ApiKeyModal, openApiKeyModal } from './api-key-modal';
import { ConfirmHost } from './confirm-modal';

@Component({
  imports: [ApiKeyModal, AlertHost, ConfirmHost],
  template: `<app-api-key-modal /><app-alert-host /><app-confirm-host />`,
})
class Shell {}

const teacher: AuthUser = {
  id: 't',
  phoneNumber: '0900000001',
  fullName: 'Cô Lan',
  role: 'teacher',
  mustChangePassword: false,
};
const student: AuthUser = { ...teacher, id: 's', role: 'student' };
const esc = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

const setup = async (user: AuthUser | null = teacher) => {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const auth = TestBed.inject(AuthService);
  if (user) (auth as unknown as { _user: { set(u: AuthUser): void } })._user.set(user);
  const f = TestBed.createComponent(Shell);
  await f.whenStable();
  const el = f.nativeElement as HTMLElement;
  const open = async () => {
    openApiKeyModal();
    await f.whenStable();
  };
  const dialog = () => el.querySelector<HTMLElement>('app-api-key-modal [role="dialog"]');
  const input = () =>
    el.querySelector<HTMLInputElement>('app-api-key-modal input[name="geminiApiKey"]');
  const type = async (v: string) => {
    const i = input()!;
    i.value = v;
    i.dispatchEvent(new Event('input'));
    await f.whenStable();
  };
  const btn = (t: string) =>
    [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.includes(t));
  const submit = async () => {
    el.querySelector('app-api-key-modal form')!.dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await f.whenStable();
  };
  const alertDlg = () => el.querySelector('app-alert-host [role="alertdialog"]');
  const alertBtn = () => el.querySelector<HTMLButtonElement>('app-alert-host button');
  return { f, el, auth, open, dialog, input, type, btn, submit, alertDlg, alertBtn };
};

describe('ApiKeyModal', () => {
  it('opens on the event for a teacher as an accessible dialog with an empty password field', async () => {
    const s = await setup();
    expect(s.dialog()).toBeNull();
    await s.open();
    const d = s.dialog()!;
    expect(d.getAttribute('aria-modal')).toBe('true');
    expect(d.getAttribute('aria-labelledby')).toBeTruthy();
    expect(s.el.querySelector(`#${d.getAttribute('aria-labelledby')}`)?.textContent).toContain(
      'Gemini API Key',
    );
    expect(s.input()!.type).toBe('password');
    expect(s.input()!.getAttribute('autocomplete')).toBe('off');
    expect(s.input()!.value).toBe('');
    expect(document.activeElement).toBe(s.input());
  });

  it.each([
    ['guest', null],
    ['student', student],
  ])('ignores the event for a %s', async (_n, user) => {
    const s = await setup(user);
    await s.open();
    expect(s.dialog()).toBeNull();
  });

  it('does not prefill the stored key; shows only the last 4 digits as status', async () => {
    const s = await setup({ ...teacher, hasApiKey: true, apiKeyLast4: 'wxyz' });
    await s.open();
    expect(s.input()!.value).toBe('');
    expect(s.dialog()!.textContent).toContain('Đã lưu: ••••wxyz');
    expect(s.btn('Xóa key')).toBeTruthy();
  });

  it('has no status and no "Xóa key" when no key is stored', async () => {
    const s = await setup();
    await s.open();
    expect(s.dialog()!.textContent).not.toContain('Đã lưu: ••••');
    expect(s.btn('Xóa key')).toBeUndefined();
  });

  it('links to Google AI Studio safely', async () => {
    const s = await setup();
    await s.open();
    const a = s.dialog()!.querySelector<HTMLAnchorElement>('a[target="_blank"]')!;
    expect(a.href).toBe('https://aistudio.google.com/app/apikey');
    expect(a.rel).toContain('noopener');
    expect(a.rel).toContain('noreferrer');
  });

  it('empty submit: inline error, focus on the field, no request', async () => {
    const s = await setup();
    const spy = vi.spyOn(s.auth, 'updateApiKey');
    await s.open();
    await s.type('   ');
    (document.activeElement as HTMLElement).blur();
    await s.submit();
    expect(s.dialog()!.textContent).toContain('Vui lòng nhập API Key hợp lệ.');
    expect(document.activeElement).toBe(s.input());
    expect(spy).not.toHaveBeenCalled();
  });

  it('blocks keys over 512 chars client-side', async () => {
    const s = await setup();
    const spy = vi.spyOn(s.auth, 'updateApiKey');
    await s.open();
    await s.type('a'.repeat(513));
    await s.submit();
    expect(s.dialog()!.textContent).toContain('512');
    expect(spy).not.toHaveBeenCalled();
  });

  it('accepts exactly 512 chars', async () => {
    const s = await setup();
    const spy = vi.spyOn(s.auth, 'updateApiKey').mockReturnValue(of({ hasApiKey: true }));
    await s.open();
    await s.type('a'.repeat(512));
    await s.submit();
    expect(spy).toHaveBeenCalledWith('a'.repeat(512));
  });

  it('success: sends the trimmed key, shows the alert, then closes and clears the input', async () => {
    const s = await setup();
    const spy = vi
      .spyOn(s.auth, 'updateApiKey')
      .mockReturnValue(of({ hasApiKey: true, apiKeyLast4: 'abcd' }));
    await s.open();
    await s.type('  AIzaKEY-abcd ');
    await s.submit();
    expect(spy).toHaveBeenCalledWith('AIzaKEY-abcd');
    expect(s.alertDlg()?.textContent).toContain('Đã lưu API Key thành công vào tài khoản của bạn!');
    expect(s.input()!.value).toBe(''); // the key leaves the DOM before the popup is acknowledged
    expect(s.dialog()).not.toBeNull(); // still open until the alert is acknowledged
    s.alertBtn()!.click();
    await s.f.whenStable();
    expect(s.dialog()).toBeNull();
    await s.open();
    expect(s.input()!.value).toBe('');
    expect(s.dialog()!.textContent).not.toContain('AIzaKEY');
  });

  it('failure: error alert with the Vietnamese message, modal stays open', async () => {
    const s = await setup();
    vi.spyOn(s.auth, 'updateApiKey').mockReturnValue(
      throwError(() => ({ success: false, code: 'NETWORK', message: 'x', status: 0 })),
    );
    await s.open();
    await s.type('k');
    await s.submit();
    expect(s.alertDlg()).not.toBeNull();
    expect(s.alertDlg()!.textContent).not.toContain('thành công');
    expect(s.dialog()).not.toBeNull();
  });

  it('double submit while pending sends one request', async () => {
    const s = await setup();
    const pending = new Subject<ApiKeyState>();
    const spy = vi.spyOn(s.auth, 'updateApiKey').mockReturnValue(pending);
    await s.open();
    await s.type('k');
    await s.submit();
    await s.submit();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(s.btn('Đang lưu')?.disabled).toBe(true);
    pending.error({ message: 'x' });
  });

  it('clear: confirm first; cancel does nothing, confirm calls updateApiKey("")', async () => {
    const s = await setup({ ...teacher, hasApiKey: true, apiKeyLast4: 'wxyz' });
    const spy = vi.spyOn(s.auth, 'updateApiKey').mockReturnValue(of({ hasApiKey: false }));
    await s.open();
    s.btn('Xóa key')!.click();
    await s.f.whenStable();
    const confirmDlg = s.el.querySelector('app-confirm-host [role="alertdialog"]')!;
    expect(confirmDlg.textContent).toContain(
      'Bạn có chắc chắn muốn xóa Gemini API Key khỏi tài khoản không?',
    );
    const cb = (t: string) =>
      [...confirmDlg.querySelectorAll('button')].find((b) => b.textContent?.includes(t))!;
    cb('Hủy').click();
    await s.f.whenStable();
    expect(spy).not.toHaveBeenCalled();
    expect(s.dialog()).not.toBeNull();

    s.btn('Xóa key')!.click();
    await s.f.whenStable();
    s.el
      .querySelector<HTMLButtonElement>(
        'app-confirm-host button.btn-danger, app-confirm-host button:last-of-type',
      )!
      .click();
    await s.f.whenStable();
    expect(spy).toHaveBeenCalledWith('');
    expect(s.alertDlg()?.textContent).toContain('Đã xóa API Key khỏi tài khoản.');
    s.alertBtn()!.click();
    await s.f.whenStable();
    expect(s.dialog()).toBeNull();
  });

  it('the key field has a stable id (author id kept by form-field) and its label points at it', async () => {
    const s = await setup();
    await s.open();
    expect(s.input()!.id).toBe('geminiApiKey');
    expect(s.dialog()!.querySelector('label')!.getAttribute('for')).toBe('geminiApiKey');
  });

  it('session end closes the modal and drops the typed key; logging in again does not reopen it', async () => {
    const s = await setup();
    await s.open();
    await s.type('secret-key');
    const user = (s.auth as unknown as { _user: { set(u: AuthUser | null): void } })._user;
    user.set(null); // logout / 401
    await s.f.whenStable();
    expect(s.dialog()).toBeNull();
    user.set(teacher);
    await s.f.whenStable();
    expect(s.dialog()).toBeNull();
    expect(s.el.innerHTML).not.toContain('secret-key');
    await s.open();
    expect(s.input()!.value).toBe('');
  });

  it('Esc closes and clears the input', async () => {
    const s = await setup();
    await s.open();
    await s.type('secret-key');
    esc();
    await s.f.whenStable();
    expect(s.dialog()).toBeNull();
    await s.open();
    expect(s.input()!.value).toBe('');
  });

  it('the Đóng button closes it', async () => {
    const s = await setup();
    await s.open();
    s.btn('Đóng')!.click();
    await s.f.whenStable();
    expect(s.dialog()).toBeNull();
  });

  it('stacking: with an alert above, Esc closes only the alert; the modal stays', async () => {
    const s = await setup();
    await s.open();
    void TestBed.inject(AlertService).error('lỗi');
    await s.f.whenStable();
    esc();
    await s.f.whenStable();
    expect(s.alertDlg()).toBeNull();
    expect(s.dialog()).not.toBeNull();
    esc();
    await s.f.whenStable();
    expect(s.dialog()).toBeNull();
  });

  it('removes the window listener on destroy', async () => {
    const s = await setup();
    s.f.destroy();
    const add = vi.spyOn(TestBed.inject(AuthService), 'isTeacher');
    openApiKeyModal();
    expect(add).not.toHaveBeenCalled();
  });
});
