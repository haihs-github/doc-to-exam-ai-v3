// Created by Haihs on 11/11/2026
// Specs for navbarVisible (pure) and <app-navbar>: link sets per role, logout flow, API-key event, hidden on /ca/*.
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import type { AuthUser } from '@doc-to-exam/contract';
import { AuthService } from '../../core/auth.service';
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
    const el = f.nativeElement as HTMLElement;
    const hrefs = () => [...el.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    const btn = (t: string) =>
      [...el.querySelectorAll('button')].find((b) => b.textContent?.includes(t));
    return { f, el, auth, router, hrefs, btn };
  };

  it('guest: About, Đăng nhập, Đăng ký, Giáo viên; no logout', async () => {
    const { el, hrefs, btn } = await setup(null);
    expect(hrefs()).toEqual(
      expect.arrayContaining(['/about', '/login', '/register', '/teacher/login']),
    );
    expect(el.textContent).toContain('Đăng nhập');
    expect(el.textContent).toContain('Giáo viên');
    expect(btn('Đăng xuất')).toBeUndefined();
    expect(hrefs()).not.toContain('/sittings');
  });

  it('student: student links + change password, no teacher links, no API-key button', async () => {
    const { hrefs, btn } = await setup(student);
    expect(hrefs()).toEqual(expect.arrayContaining(['/sittings', '/classes', '/change-password']));
    expect(hrefs()).not.toContain('/teacher/templates');
    expect(hrefs()).not.toContain('/login');
    expect(btn('API')).toBeUndefined();
    expect(btn('Đăng xuất')).toBeDefined();
  });

  it('teacher: teacher links + API-key button that dispatches open-api-key-modal', async () => {
    const { hrefs, btn } = await setup(teacher);
    expect(hrefs()).toEqual(
      expect.arrayContaining([
        '/teacher/templates',
        '/teacher/sittings',
        '/teacher/classes',
        '/change-password',
      ]),
    );
    expect(hrefs()).not.toContain('/sittings');
    const fn = vi.fn();
    window.addEventListener('open-api-key-modal', fn);
    btn('API')!.click();
    window.removeEventListener('open-api-key-modal', fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('mustChangePassword: only logout, no role links', async () => {
    const { hrefs, btn } = await setup({ ...student, mustChangePassword: true });
    expect(hrefs()).not.toContain('/sittings');
    expect(btn('Đăng xuất')).toBeDefined();
  });

  it('logout clears the session and navigates to /', async () => {
    const { f, auth, router, btn, el } = await setup(teacher, '/teacher/classes');
    btn('Đăng xuất')!.click();
    await f.whenStable();
    expect(auth.isAuthenticated()).toBe(false);
    expect(router.url).toBe('/');
    expect(el.textContent).toContain('Đăng nhập');
  });

  it('is hidden on /ca/ABC/room, visible on /ca/ABC/result, reacts to navigation', async () => {
    const { f, el, router } = await setup(student, '/ca/ABC/room');
    expect(el.querySelector('header')).toBeNull();
    await router.navigateByUrl('/ca/ABC/result');
    await f.whenStable();
    expect(el.querySelector('header')).not.toBeNull();
  });
});
