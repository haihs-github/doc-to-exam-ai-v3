// Created by Haihs on 11/11/2026
// Route table + guards integration: real `routes`, stubbed AuthService.
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { AuthUser } from '@doc-to-exam/contract';
import { AuthService } from './core/auth.service';
import { authGuard } from './core/auth.guard';
import { routes } from './app.routes';

@Component({ template: 'teacher-only' })
class TeacherOnly {}

const mk = (over: Partial<AuthUser> = {}): AuthUser => ({
  id: '1',
  phoneNumber: '0912345678',
  fullName: 'Nguyễn A',
  role: 'student',
  mustChangePassword: false,
  ...over,
});

const setup = async () => {
  const user = signal<AuthUser | null>(null);
  const isLoading = signal(false);
  const loadError = signal('');
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'teacher-only', canActivate: [authGuard(['teacher'])], component: TeacherOnly },
        ...routes,
      ]),
      {
        provide: AuthService,
        useValue: {
          user,
          isLoading,
          loadError,
          reload: vi.fn(),
          logout: vi.fn(),
          login: vi.fn(),
          register: vi.fn(),
        },
      },
    ],
  });
  const harness = await RouterTestingHarness.create();
  const router = TestBed.inject(Router);
  const go = async (url: string) => {
    await harness.navigateByUrl(url);
    await harness.fixture.whenStable();
    return router.url;
  };
  return { user, isLoading, loadError, harness, router, go };
};

describe('routes', () => {
  it('guest: / -> /about; unknown -> /about; public pages render', async () => {
    const s = await setup();
    expect(await s.go('/')).toBe('/about');
    expect(await s.go('/nope/x')).toBe('/about');
    for (const [url, text] of [
      ['/login', 'Đăng Nhập Học Sinh'],
      ['/register', 'Đăng Ký Tài Khoản Học Sinh'],
      ['/teacher/login', 'Cổng Đăng Nhập Giáo Viên'],
      ['/teacher/register', 'Đăng Ký Tài Khoản Giáo Viên'],
    ]) {
      expect(await s.go(url)).toBe(url);
      expect(s.harness.routeNativeElement?.textContent).toContain(text);
    }
  });

  it('guest on /change-password -> /login with state.from', async () => {
    const s = await setup();
    expect(await s.go('/change-password')).toBe('/login');
    expect(s.router.lastSuccessfulNavigation()?.extras.state).toEqual({ from: '/change-password' });
  });

  it('student: / shows the placeholder home; unbuilt targets fall through to / without looping', async () => {
    const s = await setup();
    s.user.set(mk());
    expect(await s.go('/')).toBe('/');
    expect(s.harness.routeNativeElement?.textContent).toContain('Xin chào, Nguyễn A');
    expect(await s.go('/sittings')).toBe('/');
    expect(await s.go('/teacher/templates')).toBe('/');
  });

  it('teacher: / shows the placeholder home', async () => {
    const s = await setup();
    s.user.set(mk({ role: 'teacher', fullName: 'Cô B' }));
    expect(await s.go('/')).toBe('/');
    expect(s.harness.routeNativeElement?.textContent).toContain('Xin chào, Cô B');
  });

  it('student on a teacher route -> /', async () => {
    const s = await setup();
    s.user.set(mk());
    expect(await s.go('/teacher-only')).toBe('/');
  });

  it('mustChangePassword: / and guarded routes -> /change-password, which itself is reachable', async () => {
    const s = await setup();
    s.user.set(mk({ mustChangePassword: true }));
    expect(await s.go('/')).toBe('/change-password');
    expect(await s.go('/teacher-only')).toBe('/change-password');
    expect(await s.go('/change-password')).toBe('/change-password');
    expect(s.harness.routeNativeElement?.textContent).toContain(
      'Bạn cần đổi mật khẩu để tiếp tục.',
    );
  });

  it('logged-in user on /login is sent to postLoginPath (user() set), mustChangePassword first', async () => {
    const s = await setup();
    s.user.set(mk({ mustChangePassword: true }));
    expect(await s.go('/login')).toBe('/change-password');
  });

  it('loadError without a user -> /session-error from / and from guarded routes', async () => {
    const s = await setup();
    s.loadError.set('Không kết nối được máy chủ.');
    expect(await s.go('/')).toBe('/session-error');
    expect(s.harness.routeNativeElement?.textContent).toContain('Không kết nối được máy chủ.');
    expect(await s.go('/change-password')).toBe('/session-error');
  });

  it('/session-error without a loadError is not a dead end', async () => {
    const s = await setup();
    expect(await s.go('/session-error')).toBe('/about');
    s.user.set(mk());
    expect(await s.go('/session-error')).toBe('/');
  });

  it('/ waits for the startup /me load (no flash of /about for a logged-in user)', async () => {
    const s = await setup();
    s.isLoading.set(true);
    const nav = s.router.navigateByUrl('/');
    await new Promise((r) => setTimeout(r, 20)); // whenStable would hang: the pending navigation is a stability task
    expect(s.router.url).not.toBe('/about');
    s.user.set(mk());
    s.isLoading.set(false);
    TestBed.tick();
    await nav;
    expect(s.router.url).toBe('/');
  });
});
