// Created by Haihs on 11/11/2026
// /session-error: the startup /me failed transiently (token kept); retry or log out (port of ProtectedRoute.jsx loadError view).
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { navigationFrom } from './form-helpers';

@Component({
  selector: 'app-session-error',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-[60vh] flex items-center justify-center p-4">
      <div class="text-center space-y-3 max-w-sm">
        <p role="alert" class="text-gray-700 dark:text-gray-200 font-semibold text-base">
          {{ auth.loadError() }}
        </p>
        <div class="flex flex-wrap justify-center gap-2">
          <button type="button" class="btn-primary" (click)="retry()" [disabled]="auth.isLoading()">
            {{ auth.isLoading() ? 'Đang thử lại...' : 'Thử lại' }}
          </button>
          <button type="button" class="btn-secondary" (click)="logout()">Đăng xuất</button>
        </div>
      </div>
    </div>
  `,
})
export class SessionError {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly from = navigationFrom(this.router);
  private readonly retrying = signal(false);

  constructor() {
    // Moves on only after the user pressed "Thử lại" and the reload settled, so nothing redirects by itself.
    effect(() => {
      if (!this.retrying()) return;
      const user = this.auth.user();
      const loading = this.auth.isLoading();
      const error = this.auth.loadError();
      untracked(() => {
        if (user) void this.router.navigateByUrl(this.from ?? '/', { replaceUrl: true });
        else if (!loading && !error) void this.router.navigateByUrl('/login', { replaceUrl: true }); // 401: session is gone
      });
    });
  }

  protected retry(): void {
    this.retrying.set(true);
    this.auth.reload();
  }

  protected logout(): void {
    this.retrying.set(false);
    this.auth.logout();
    void this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
