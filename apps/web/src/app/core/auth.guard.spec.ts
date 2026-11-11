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
import { authGuard } from './auth.guard';

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
  const run = (guard: ReturnType<typeof authGuard>, url: string) =>
    TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    );
  beforeEach(() => {
    user.set(null);
    isLoading.set(false);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: { user, isLoading } }],
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
});
