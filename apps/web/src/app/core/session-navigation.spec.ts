// Created by Haihs on 12/11/2026
// Specs for SessionNavigation: mid-use 401 and MUST_CHANGE_PASSWORD navigate without a guard run.
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { AuthUser, UserRole } from '@doc-to-exam/contract';
import { AuthService } from './auth.service';
import { SessionNavigation } from './session-navigation';

@Component({ template: '' })
class Page {}

const mk = (role: UserRole = 'teacher', over: Partial<AuthUser> = {}): AuthUser => ({
  id: '1',
  phoneNumber: '1',
  fullName: 'n',
  role,
  mustChangePassword: false,
  ...over,
});

describe('SessionNavigation', () => {
  const user = signal<AuthUser | null>(null);
  const sessionEnded = signal<{ role: UserRole } | null>(null);
  let harness: RouterTestingHarness;
  const router = () => TestBed.inject(Router);

  beforeEach(async () => {
    user.set(null);
    sessionEnded.set(null);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'teacher/login', component: Page },
          { path: 'login', component: Page },
          { path: 'change-password', component: Page },
          { path: 'work', component: Page },
        ]),
        { provide: AuthService, useValue: { user, sessionEnded } },
      ],
    });
    TestBed.inject(SessionNavigation);
    harness = await RouterTestingHarness.create();
  });

  it('teacher session revoked on a protected page -> /teacher/login with state.from', async () => {
    user.set(mk('teacher'));
    await harness.navigateByUrl('/work?x=1');
    const spy = vi.spyOn(router(), 'navigateByUrl');
    user.set(null);
    sessionEnded.set({ role: 'teacher' });
    await harness.fixture.whenStable();
    expect(router().url).toBe('/teacher/login');
    expect(spy).toHaveBeenCalledWith(
      '/teacher/login',
      expect.objectContaining({ replaceUrl: true, state: { from: '/work?x=1' } }),
    );
  });

  it('student session revoked -> /login', async () => {
    await harness.navigateByUrl('/work');
    sessionEnded.set({ role: 'student' });
    await harness.fixture.whenStable();
    expect(router().url).toBe('/login');
  });

  it('already on a login page: no navigation loop', async () => {
    await harness.navigateByUrl('/login');
    const spy = vi.spyOn(router(), 'navigateByUrl');
    sessionEnded.set({ role: 'student' });
    await harness.fixture.whenStable();
    expect(spy).not.toHaveBeenCalled();
  });

  it('mustChangePassword while using the app -> /change-password', async () => {
    user.set(mk());
    await harness.navigateByUrl('/work');
    user.set(mk('teacher', { mustChangePassword: true }));
    await harness.fixture.whenStable();
    expect(router().url).toBe('/change-password');
  });

  it('already on /change-password: stays, no extra navigation', async () => {
    await harness.navigateByUrl('/change-password');
    const spy = vi.spyOn(router(), 'navigateByUrl');
    user.set(mk('teacher', { mustChangePassword: true }));
    await harness.fixture.whenStable();
    expect(spy).not.toHaveBeenCalled();
  });
});
