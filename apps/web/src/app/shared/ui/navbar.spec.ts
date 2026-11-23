// Created by Haihs on 11/11/2026
// Specs for navbarVisible (pure) and <app-navbar>: link sets per role, logout flow, API-key event, hidden on /ca/*.
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import type { AuthUser } from '@doc-to-exam/contract';
import { AuthService } from '../../core/auth.service';
import { ConfirmHost } from './confirm-modal';
import { Navbar, navbarVisible } from './navbar';

@Component({ template: '' })
class Blank {}

describe('navbarVisible', () => {
  it.each([
    ['/', true],
    ['/login', true],
    ['/ca/ABC', false],
    ['/ca/ABC/room', false],
    ['/ca/ABC/done', false],
    ['/ca/ABC/result', true],
    ['/ca/ABC/result/', true],
    ['/ca/ABC/result?x=1', true],
    ['/ca/ABC/room?x=/result', false],
    ['/ca/ABC/result/extra', false],
    ['/cabin/x', true],
    ['/sittings', true],
  ])('%s -> %s', (url, expected) => expect(navbarVisible(url)).toBe(expected));
});

const teacher: AuthUser = {
  id: 't',
  phoneNumber: '0900000001',
  fullName: 'Cô Lan',
  role: 'teacher',
  mustChangePassword: false,
};
const student: AuthUser = { ...teacher, id: 's', fullName: 'Em An', role: 'student' };

describe('Navbar', () => {
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
    const f = TestBed.createComponent(Navbar);
    await f.whenStable();
    const host = TestBed.createComponent(ConfirmHost); // the logout confirmation renders here
    await host.whenStable();
    const confirmBtn = (t: string) =>
      [...(host.nativeElement as HTMLElement).querySelectorAll('button')].find(
        (b) => b.textContent?.trim() === t,
      );
    const el = f.nativeElement as HTMLElement;
    const hrefs = () => [...el.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    const btn = (t: string) =>
      [...el.querySelectorAll('button')].find((b) => b.textContent?.includes(t));
    return { f, host, confirmBtn, el, auth, router, hrefs, btn };
  };

  // Haihs: header khách giống bản cũ - start
  // đóng code cũ
  //   it('guest: About, Đăng nhập, Đăng ký, Giáo viên; no logout', async () => {
  //     const { el, hrefs, btn } = await setup(null);
  //     expect(hrefs()).toEqual(
  //       expect.arrayContaining(['/about', '/login', '/register', '/teacher/login']),
  //     );
  //     expect(el.textContent).toContain('Đăng nhập');
  //     expect(el.textContent).toContain('Giáo viên');
  //     expect(btn('Đăng xuất')).toBeUndefined();
  //     expect(hrefs()).not.toContain('/sittings');
  //   });
  it('guest: only theme toggle + Đăng Nhập/Đăng Ký (teacher routes), like the original; no logout', async () => {
    const { el, hrefs, btn } = await setup(null);
    expect(hrefs()).toEqual(['/', '/teacher/login', '/teacher/register']);
    expect(el.textContent).toContain('Đăng Nhập');
    expect(el.textContent).toContain('Đăng Ký');
    expect(el.textContent).not.toContain('Giới thiệu');
    expect(el.textContent).not.toContain('Giáo viên');
    expect(btn('Đăng xuất')).toBeUndefined();
  });

  // Haihs: header khách giống bản cũ - end

  // Haihs: link theo vai trò, API Key, Đăng xuất chuyển sang sidebar; các test này được viết lại trong sidebar.spec.ts, thanh trên chỉ giữ test mới bên dưới - start
  // đóng code cũ
  //   it('student: student links + change password, no teacher links, no API-key button', async () => {
  //     const { hrefs, btn } = await setup(student);
  //     expect(hrefs()).toEqual(expect.arrayContaining(['/sittings', '/classes', '/change-password']));
  //     expect(hrefs()).not.toContain('/teacher/templates');
  //     expect(hrefs()).not.toContain('/login');
  //     expect(btn('API')).toBeUndefined();
  //     expect(btn('Đăng xuất')).toBeDefined();
  //   });
  //
  //   it('teacher: teacher links + API-key button that dispatches open-api-key-modal', async () => {
  //     const { hrefs, btn } = await setup(teacher);
  //     expect(hrefs()).toEqual(
  //       expect.arrayContaining([
  //         '/teacher/templates',
  //         '/teacher/sittings',
  //         '/teacher/classes',
  //         '/change-password',
  //       ]),
  //     );
  //     expect(hrefs()).not.toContain('/sittings');
  //     const fn = vi.fn();
  //     window.addEventListener('open-api-key-modal', fn);
  //     btn('API')!.click();
  //     window.removeEventListener('open-api-key-modal', fn);
  //     expect(fn).toHaveBeenCalledTimes(1);
  //   });
  //
  //   it('mustChangePassword: only logout, no role links', async () => {
  //     const { hrefs, btn } = await setup({ ...student, mustChangePassword: true });
  //     expect(hrefs()).not.toContain('/sittings');
  //     expect(btn('Đăng xuất')).toBeDefined();
  //   });
  //
  //   it.each([
  //     [teacher, '/teacher/login'],
  //     [student, '/login'],
  //   ])(
  //     'logout asks for confirmation, then clears the session and goes to the role login (%#)',
  //     async (user, dest) => {
  //       const { f, host, auth, router, btn, confirmBtn } = await setup(user, '/change-password');
  //       btn('Đăng xuất')!.click();
  //       await host.whenStable();
  //       expect(auth.isAuthenticated()).toBe(true); // nothing happens before the answer
  //       confirmBtn('Đăng xuất')!.click();
  //       await host.whenStable();
  //       await f.whenStable();
  //       expect(auth.isAuthenticated()).toBe(false);
  //       expect(router.url).toBe(dest);
  //     },
  //   );
  //
  //   it('cancelling the logout confirmation keeps the session and the page', async () => {
  //     const { f, host, auth, router, btn, confirmBtn } = await setup(teacher, '/teacher/classes');
  //     btn('Đăng xuất')!.click();
  //     await host.whenStable();
  //     confirmBtn('Ở lại')!.click();
  //     await host.whenStable();
  //     await f.whenStable();
  //     expect(auth.isAuthenticated()).toBe(true);
  //     expect(router.url).toBe('/teacher/classes');
  //   });
  //
  //   it('the active link has aria-current=page, others do not', async () => {
  //     const { el } = await setup(teacher, '/teacher/classes');
  //     const cur = [...el.querySelectorAll('nav a')].filter(
  //       (a) => a.getAttribute('aria-current') === 'page',
  //     );
  //     expect(cur.map((a) => a.getAttribute('href'))).toEqual(['/teacher/classes']);
  //   });
  //
  it('authenticated: no role links / API-key / logout in the top bar, shows the name and the theme toggle', async () => {
    const { el, hrefs, btn } = await setup(teacher);
    expect(hrefs()).toEqual(['/']);
    expect(btn('API')).toBeUndefined();
    expect(btn('Đăng xuất')).toBeUndefined();
    expect(el.textContent).toContain('Cô Lan');
    expect(el.querySelector('app-theme-toggle')).not.toBeNull();
  });

  it('authenticated: hamburger + collapse buttons exist; guest has neither', async () => {
    const a = await setup(student);
    expect(a.el.querySelector('#navToggle')).not.toBeNull();
    expect(a.el.querySelector('#sbToggle')).not.toBeNull();
    TestBed.resetTestingModule();
    const g = await setup(null);
    expect(g.el.querySelector('#navToggle')).toBeNull();
    expect(g.el.querySelector('#sbToggle')).toBeNull();
  });
  // Haihs: link theo vai trò, API Key, Đăng xuất chuyển sang sidebar; các test này được viết lại trong sidebar.spec.ts, thanh trên chỉ giữ test mới bên dưới - end

  it('is hidden on /ca/ABC/room, visible on /ca/ABC/result, reacts to navigation', async () => {
    const { f, el, router } = await setup(student, '/ca/ABC/room');
    expect(el.querySelector('header')).toBeNull();
    await router.navigateByUrl('/ca/ABC/result');
    await f.whenStable();
    expect(el.querySelector('header')).not.toBeNull();
  });
});
