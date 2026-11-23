// Created by Haihs on 11/11/2026
// Session state (port of client AuthContext.jsx): current user, startup /me load, login/register/password/api-key actions.
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Observable, Subscription, map, tap, timeout } from 'rxjs';
import type {
  AuthResult,
  AuthUser,
  ApiKeyBody,
  ApiKeyState,
  ChangePasswordBody,
  LoginBody,
  RegisterBody,
  UserRole,
} from '@doc-to-exam/contract';
import { ApiClient, ApiFailure } from './api-client';
import { errorMessage } from './api-errors';
import { MUST_CHANGE_PASSWORD_EVENT, UNAUTHENTICATED_EVENT } from './auth.interceptor';
import { TokenStore } from './token-store';

const ME_TIMEOUT_MS = 120_000;

export type Audience = 'teacher' | 'student';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiClient);
  private readonly tokens = inject(TokenStore);
  private readonly _user = signal<AuthUser | null>(null);
  private readonly _isLoading = signal(false);
  private readonly _loadError = signal('');
  private loading?: Subscription; // unsubscribing = the stale-response gate (latest load / logout / login wins)

  private readonly _sessionEnded = signal<{ role: UserRole } | null>(null);
  /** A new object each time the server revoked a live session (401 with a user); SessionNavigation reacts. */
  readonly sessionEnded = this._sessionEnded.asReadonly();
  readonly user = this._user.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly loadError = this._loadError.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly isTeacher = computed(() => this._user()?.role === 'teacher');
  readonly isStudent = computed(() => this._user()?.role === 'student');

  constructor() {
    const onUnauth = () => {
      const prev = this._user();
      this.logout();
      // only a session that existed ends "in the middle": a 401 for a wrong password on /login must not navigate
      if (prev) this._sessionEnded.set({ role: prev.role });
    };
    const onMust = () => this._user.update((u) => (u ? { ...u, mustChangePassword: true } : u));
    window.addEventListener(UNAUTHENTICATED_EVENT, onUnauth);
    window.addEventListener(MUST_CHANGE_PASSWORD_EVENT, onMust);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener(UNAUTHENTICATED_EVENT, onUnauth);
      window.removeEventListener(MUST_CHANGE_PASSWORD_EVENT, onMust);
      this.loading?.unsubscribe();
    });
    this.reload();
  }

  /** Loads /api/auth/me for the stored token: 401 logs out, other errors keep the token and set loadError. */
  reload(): void {
    this.loading?.unsubscribe();
    if (!this.tokens.get()) {
      this._isLoading.set(false);
      return;
    }
    this._isLoading.set(true);
    this._loadError.set('');
    this.loading = this.api
      .get<AuthUser>('/api/auth/me')
      .pipe(timeout(ME_TIMEOUT_MS)) // source axios timeout 120s; TimeoutError is a plain error -> loadError
      .subscribe({
        next: (u) => {
          this._user.set(u);
          this._isLoading.set(false);
        },
        error: (e: unknown) => {
          if ((e as { status?: number }).status === 401) this.logout();
          else {
            this._loadError.set(errorMessage(e));
            this._isLoading.set(false);
          }
        },
      });
  }

  logout(): void {
    this.loading?.unsubscribe();
    this.tokens.clear();
    this._user.set(null);
    this._loadError.set('');
    this._isLoading.set(false);
  }

  login(audience: Audience, body: LoginBody): Observable<AuthResult> {
    return this.api
      .post<AuthResult>(`/api/auth/${audience}/login`, body)
      .pipe(tap((r) => this.applyAuth(r)));
  }

  /** Haihs: trang đăng ký hỏi API có cần mã bí mật giáo viên không - start */
  registerConfig(): Observable<{ teacherSecretRequired: boolean }> {
    return this.api.get<{ teacherSecretRequired: boolean }>('/api/auth/config');
  }
  /** Haihs: trang đăng ký hỏi API có cần mã bí mật giáo viên không - end */

  register(audience: Audience, body: RegisterBody): Observable<AuthResult> {
    return this.api
      .post<AuthResult>(`/api/auth/${audience}/register`, body)
      .pipe(tap((r) => this.applyAuth(r)));
  }

  /** The server rotates the token (old ones die), so the NEW token is stored. */
  changePassword(body: ChangePasswordBody): Observable<AuthResult> {
    return this.api
      .post<AuthResult>('/api/auth/change-password', body)
      .pipe(tap((r) => this.applyAuth(r)));
  }

  logoutAll(): Observable<void> {
    return this.api.post<unknown>('/api/auth/logout-all').pipe(
      tap(() => this.logout()),
      map(() => undefined),
    );
  }

  updateApiKey(key: string): Observable<ApiKeyState> {
    const body: ApiKeyBody = { geminiApiKey: key };
    return this.api
      .put<ApiKeyState>('/api/auth/api-key', body)
      .pipe(
        tap((s) =>
          this._user.update((u) =>
            u ? { ...u, hasApiKey: s.hasApiKey, apiKeyLast4: s.apiKeyLast4 ?? '' } : u,
          ),
        ),
      );
  }

  private applyAuth(r: AuthResult): void {
    // validate before any state/storage change
    if (typeof r?.token !== 'string' || !r.token || !r.user) {
      const bad: ApiFailure = {
        success: false,
        code: 'INTERNAL',
        message: 'Có lỗi xảy ra. Vui lòng thử lại!',
        status: 200,
      };
      throw bad;
    }
    this.loading?.unsubscribe(); // a pending /me must not overwrite the fresh session
    this.tokens.set(r.token);
    this._user.set(r.user);
    this._loadError.set('');
    this._isLoading.set(false);
  }
}
