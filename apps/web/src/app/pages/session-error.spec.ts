// Created by Haihs on 11/11/2026
// Specs for the session-error page: shows loadError, retry navigates only on success, logout leaves, no redirect loops.
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { AuthUser } from '@doc-to-exam/contract';
import { AuthService } from '../core/auth.service';
import { SessionError } from './session-error';

@Component({ template: 'dummy' })
class Dummy {}

const mk = (): AuthUser => ({
  id: '1',
  phoneNumber: '0912345678',
  fullName: 'A',
  role: 'student',
  mustChangePassword: false,
});

const setup = async (from?: string) => {
  const user = signal<AuthUser | null>(null);
  const loadError = signal('Không kết nối được máy chủ.');
  const isLoading = signal(false);
  const reload = vi.fn();
  const logout = vi.fn(() => user.set(null));
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'session-error', component: SessionError },
        { path: '**', component: Dummy },
      ]),
      { provide: AuthService, useValue: { user, loadError, isLoading, reload, logout } },
    ],
  });
  const harness = await RouterTestingHarness.create();
  const router = TestBed.inject(Router);
  await router.navigateByUrl('/session-error', { state: from ? { from } : undefined });
  await harness.fixture.whenStable();
  const el = harness.routeNativeElement as HTMLElement;
  const btn = (t: string) =>
    [...el.querySelectorAll('button')].find((b) => b.textContent?.includes(t))!;
  return { user, loadError, isLoading, reload, logout, harness, router, el, btn };
};

describe('SessionError', () => {
  it('shows auth.loadError() and does not navigate by itself', async () => {
    const s = await setup('/sittings');
    expect(s.el.textContent).toContain('Không kết nối được máy chủ.');
    expect(s.router.url).toBe('/session-error');
    expect(s.reload).not.toHaveBeenCalled();
  });

  it('Thử lại reloads; still failing -> stays', async () => {
    const s = await setup('/sittings');
    s.btn('Thử lại').click();
    await s.harness.fixture.whenStable();
    expect(s.reload).toHaveBeenCalledTimes(1);
    expect(s.router.url).toBe('/session-error');
  });

  it('after a successful reload (user set) it goes to state.from, else /', async () => {
    const a = await setup('/sittings');
    a.btn('Thử lại').click();
    a.loadError.set('');
    a.user.set(mk());
    await a.harness.fixture.whenStable();
    expect(a.router.url).toBe('/sittings');
    TestBed.resetTestingModule();
    const b = await setup();
    b.btn('Thử lại').click();
    b.user.set(mk());
    await b.harness.fixture.whenStable();
    expect(b.router.url).toBe('/');
  });

  it('retry that ends with a 401 (logged out, no error) goes to /login', async () => {
    const s = await setup('/sittings');
    s.btn('Thử lại').click();
    s.loadError.set('');
    await s.harness.fixture.whenStable();
    expect(s.router.url).toBe('/login');
  });

  it('keeps the old message visible while retrying (alert never empties)', async () => {
    const s = await setup();
    s.btn('Thử lại').click();
    s.loadError.set(''); // reload() clears loadError
    s.isLoading.set(true);
    await s.harness.fixture.whenStable();
    expect(s.el.querySelector('[role="alert"]')?.textContent).toContain(
      'Không kết nối được máy chủ.',
    );
  });

  it('retry button is disabled and relabelled while loading', async () => {
    const s = await setup();
    s.isLoading.set(true);
    await s.harness.fixture.whenStable();
    expect(s.btn('Đang thử lại').disabled).toBe(true);
  });

  it('Đăng xuất logs out and goes to /login', async () => {
    const s = await setup('/sittings');
    s.btn('Đăng xuất').click();
    await s.harness.fixture.whenStable();
    expect(s.logout).toHaveBeenCalledTimes(1);
    expect(s.router.url).toBe('/login');
  });

  it('a user appearing without pressing retry does not redirect (no loops)', async () => {
    const s = await setup('/sittings');
    s.user.set(mk());
    await s.harness.fixture.whenStable();
    expect(s.router.url).toBe('/session-error');
  });
});
