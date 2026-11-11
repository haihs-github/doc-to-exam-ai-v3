// Created by Haihs on 11/11/2026
// Specs for authGuard: decideRoute integration, state.url as path, waits while loading.
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  RedirectCommand,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { Observable, firstValueFrom, isObservable } from 'rxjs';
import type { AuthUser } from '@doc-to-exam/contract';
import { AuthService } from './auth.service';
import { SESSION_ERROR_PATH, authGuard } from './auth.guard';

const mk = (over: Partial<AuthUser> = {}): AuthUser => ({
  id: '1',
  phoneNumber: '1',
  fullName: 'n',
  role: 'teacher',
  mustChangePassword: false,
  ...over,
});

describe('authGuard', () => {
  const user = signal<AuthUser | null>(null);
  const isLoading = signal(false);
  const loadError = signal('');
  const run = (guard: ReturnType<typeof authGuard>, url: string) =>
    TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    );
  beforeEach(() => {
    user.set(null);
    isLoading.set(false);
    loadError.set('');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { user, isLoading, loadError } },
      ],
    });
  });
  const str = (r: unknown) => TestBed.inject(Router).serializeUrl(r as UrlTree);

  it('allows a matching user', () => {
    user.set(mk());
    expect(run(authGuard(['teacher']), '/x')).toBe(true);
  });

  it('anonymous -> login by audience, keeping the target in state.from', () => {
    const r = run(authGuard(['teacher']), '/exams/1') as RedirectCommand;
    expect(r).toBeInstanceOf(RedirectCommand);
    expect(str(r.redirectTo)).toBe('/teacher/login');
    expect(r.navigationBehaviorOptions?.state).toEqual({ from: '/exams/1' });
    const s = run(authGuard(['student'], 'student'), '/sittings') as RedirectCommand;
    expect(str(s.redirectTo)).toBe('/login');
  });

  it('wrong role -> redirect to /', () => {
    user.set(mk({ role: 'student' }));
    const r = run(authGuard(['teacher']), '/x') as UrlTree;
    expect(r).toBeInstanceOf(UrlTree);
    expect(str(r)).toBe('/');
  });

  it('mustChangePassword: redirect elsewhere, but allow on /change-password (state.url passed, no loop)', () => {
    user.set(mk({ mustChangePassword: true }));
    expect(str(run(authGuard(), '/exams'))).toBe('/change-password');
    expect(run(authGuard(), '/change-password')).toBe(true);
  });

  it('waits while loading, then decides with the loaded user (no flash of login)', async () => {
    isLoading.set(true);
    const r = run(authGuard(['teacher']), '/x');
    expect(isObservable(r)).toBe(true);
    const p = firstValueFrom(r as Observable<unknown>);
    user.set(mk());
    isLoading.set(false);
    TestBed.tick();
    expect(await p).toBe(true);
  });

  it('token kept + loadError (user null) -> /session-error with state.from, NOT login', () => {
    loadError.set('Không kết nối được máy chủ.');
    for (const g of [authGuard(['teacher']), authGuard(['student'], 'student'), authGuard()]) {
      const r = run(g, '/exams/1') as RedirectCommand;
      expect(r).toBeInstanceOf(RedirectCommand);
      expect(str(r.redirectTo)).toBe('/session-error');
      expect(r.navigationBehaviorOptions?.state).toEqual({ from: '/exams/1' });
      expect(r.navigationBehaviorOptions?.replaceUrl).toBe(true);
    }
    expect(SESSION_ERROR_PATH).toBe('/session-error');
  });

  it('loadError ignored when a user exists; no loadError and user null -> login as before', () => {
    user.set(mk());
    loadError.set('x');
    expect(run(authGuard(['teacher']), '/x')).toBe(true);
    user.set(null);
    loadError.set('');
    expect(str((run(authGuard(['teacher']), '/x') as RedirectCommand).redirectTo)).toBe(
      '/teacher/login',
    );
  });

  it('login redirect uses replaceUrl', () => {
    const r = run(authGuard(['teacher']), '/x') as RedirectCommand;
    expect(r.navigationBehaviorOptions?.replaceUrl).toBe(true);
  });
});
