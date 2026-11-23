// Created by Haihs on 23/11/2026
// Specs for <app-sidebar>: mục theo vai trò, nút API Key, Đăng xuất có confirm, Esc, aria-expanded của nút thu gọn.
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import type { AuthUser } from '@doc-to-exam/contract';
import { AuthService } from '../../core/auth.service';
import { ConfirmHost } from './confirm-modal';
import { Navbar } from './navbar';
import { ShellState } from './shell-state';
import { Sidebar } from './sidebar';

@Component({ template: '' })
class Blank {}

const teacher: AuthUser = {
  id: 't',
  phoneNumber: '0900000001',
  fullName: 'Cô Lan',
  role: 'teacher',
  mustChangePassword: false,
};
const student: AuthUser = { ...teacher, id: 's', fullName: 'Em An', role: 'student' };

describe('Sidebar', () => {
  const setup = async (user: AuthUser | null, url = '/') => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', component: Blank }]),
      ],
    });
    const auth = TestBed.inject(AuthService);
    if (user) (auth as unknown as { _user: { set(u: AuthUser): void } })._user.set(user);
    const router = TestBed.inject(Router);
    await router.navigateByUrl(url);
    const f = TestBed.createComponent(Sidebar);
    await f.whenStable();
    const host = TestBed.createComponent(ConfirmHost);
    await host.whenStable();
    const confirmBtn = (t: string) =>
      [...(host.nativeElement as HTMLElement).querySelectorAll('button')].find(
        (b) => b.textContent?.trim() === t,
      );
    const el = f.nativeElement as HTMLElement;
    const hrefs = () => [...el.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    const btn = (t: string) =>
      [...el.querySelectorAll('button')].find((b) => b.textContent?.includes(t));
    return { f, host, confirmBtn, el, auth, router, hrefs, btn, shell: TestBed.inject(ShellState) };
  };

  it('guest: no sidebar at all', async () => {
    const { el } = await setup(null);
    expect(el.querySelector('aside')).toBeNull();
  });

  it('student: student links + change password, no teacher links, no API-key button', async () => {
    const { hrefs, btn, el } = await setup(student);
    expect(hrefs()).toEqual(['/sittings', '/classes', '/change-password']);
    expect(btn('API')).toBeUndefined();
    expect(btn('Đăng xuất')).toBeDefined();
    expect(el.textContent).toContain('Em An');
  });

  it('teacher: teacher links + API-key button that dispatches open-api-key-modal', async () => {
    const { hrefs, btn } = await setup(teacher);
    expect(hrefs()).toEqual([
      '/teacher/templates',
      '/teacher/sittings',
      '/teacher/classes',
      '/change-password',
    ]);
    const fn = vi.fn();
    window.addEventListener('open-api-key-modal', fn);
    btn('API')!.click();
    window.removeEventListener('open-api-key-modal', fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('mustChangePassword: only logout, no role links', async () => {
    const { hrefs, btn } = await setup({ ...student, mustChangePassword: true });
    expect(hrefs()).toEqual([]);
    expect(btn('Đăng xuất')).toBeDefined();
  });

  it('the active link has aria-current=page, others do not', async () => {
    const { el } = await setup(teacher, '/teacher/classes');
    const cur = [...el.querySelectorAll('a')].filter(
      (a) => a.getAttribute('aria-current') === 'page',
    );
    expect(cur.map((a) => a.getAttribute('href'))).toEqual(['/teacher/classes']);
  });

  it.each([
    [teacher, '/teacher/login'],
    [student, '/login'],
  ])('logout asks for confirmation, then clears the session and goes to the role login (%#)', async (user, dest) => {
    const { f, host, auth, router, btn, confirmBtn } = await setup(user, '/change-password');
    btn('Đăng xuất')!.click();
    await host.whenStable();
    expect(auth.isAuthenticated()).toBe(true);
    confirmBtn('Đăng xuất')!.click();
    await host.whenStable();
    await f.whenStable();
    expect(auth.isAuthenticated()).toBe(false);
    expect(router.url).toBe(dest);
  });

  it('cancelling the logout confirmation keeps the session and the page', async () => {
    const { f, host, auth, router, btn, confirmBtn } = await setup(teacher, '/teacher/classes');
    btn('Đăng xuất')!.click();
    await host.whenStable();
    confirmBtn('Ở lại')!.click();
    await host.whenStable();
    await f.whenStable();
    expect(auth.isAuthenticated()).toBe(true);
    expect(router.url).toBe('/teacher/classes');
  });

  it('Esc closes the sliding menu; navigating closes it too', async () => {
    const { f, shell, router } = await setup(student);
    shell.open.set(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(shell.open()).toBe(false);
    shell.open.set(true);
    await router.navigateByUrl('/classes');
    await f.whenStable();
    expect(shell.open()).toBe(false);
  });

  it('collapse button (in the navbar) flips aria-expanded and shrinks the sidebar labels', async () => {
    const { el, shell } = await setup(student);
    const nav = TestBed.createComponent(Navbar);
    await nav.whenStable();
    const toggle = (nav.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('#sbToggle')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    toggle.click();
    await nav.whenStable();
    expect(shell.collapsed()).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelector('aside')!.className).toContain('md:w-[4.25rem]');
  });

  it('hamburger (mobile) opens the menu and flips aria-expanded', async () => {
    const { shell } = await setup(student);
    const nav = TestBed.createComponent(Navbar);
    await nav.whenStable();
    const burger = (nav.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('#navToggle')!;
    expect(burger.getAttribute('aria-expanded')).toBe('false');
    burger.click();
    await nav.whenStable();
    expect(shell.open()).toBe(true);
    expect(burger.getAttribute('aria-expanded')).toBe('true');
  });

  describe('a11y của menu trượt', () => {
    const mount = async () => {
      const ctx = await setup(student);
      const nav = TestBed.createComponent(Navbar);
      await nav.whenStable();
      document.body.append(nav.nativeElement, ctx.el);
      const burger = document.getElementById('navToggle')!;
      return { ...ctx, burger };
    };
    afterEach(() => (document.body.innerHTML = ''));

    it('both toggles have aria-controls pointing at the aside id; navs have distinct labels', async () => {
      const { el } = await mount();
      const id = el.querySelector('aside')!.id;
      expect(id).toBe('sidebar');
      expect(document.getElementById('navToggle')!.getAttribute('aria-controls')).toBe(id);
      expect(document.getElementById('sbToggle')!.getAttribute('aria-controls')).toBe(id);
      const labels = [...document.querySelectorAll('nav')].map((n) => n.getAttribute('aria-label'));
      expect(new Set(labels).size).toBe(labels.length);
    });

    it('opening moves focus into the sidebar; Esc closes it and returns focus to the opener', async () => {
      const { f, shell, el, burger } = await mount();
      burger.focus();
      shell.open.set(true);
      await f.whenStable();
      expect(el.querySelector('aside')!.contains(document.activeElement)).toBe(true);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await f.whenStable();
      expect(shell.open()).toBe(false);
      expect(document.activeElement).toBe(burger);
    });

    it('Tab wraps inside the open menu', async () => {
      const { f, shell, el } = await mount();
      shell.open.set(true);
      await f.whenStable();
      const items = [...el.querySelectorAll<HTMLElement>('aside a[href], aside button')];
      items.at(-1)!.focus();
      const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      el.querySelector('aside')!.dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(items[0]);
    });

    it('Esc does not close the menu while a modal is open', async () => {
      const { shell } = await mount();
      shell.open.set(true);
      const m = document.createElement('div');
      m.setAttribute('appModalFocus', '');
      document.body.append(m);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(shell.open()).toBe(true);
    });
  });
});
