// Created by Haihs on 12/11/2026
// Router reaction to a session lost or locked mid-use (guards only run on navigation; the source ProtectedRoute re-rendered).
import { Injectable, effect, inject, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { decideRoute } from '../shared/utils/auth-routing';
import { AuthService } from './auth.service';

const pathOf = (url: string): string => url.split(/[?#]/)[0].replace(/\/+$/, '');
const LOGIN_PATHS = ['/login', '/teacher/login'];

@Injectable({ providedIn: 'root' })
export class SessionNavigation {
  constructor() {
    const auth = inject(AuthService);
    const router = inject(Router);

    // 401 while a user was logged in (logout-all elsewhere, expiry): go to that role's login, remembering where we were.
    effect(() => {
      const ended = auth.sessionEnded();
      if (!ended) return;
      untracked(() => {
        if (LOGIN_PATHS.includes(pathOf(router.url))) return;
        const d = decideRoute({
          user: null,
          audience: ended.role === 'teacher' ? 'teacher' : 'student',
          path: router.url,
        });
        if (d.kind === 'redirect')
          void router.navigateByUrl(d.to, { replaceUrl: true, state: d.state as object });
      });
    });

    // 403 MUST_CHANGE_PASSWORD: the only page left is /change-password (no loop when already there).
    effect(() => {
      if (!auth.user()?.mustChangePassword) return;
      untracked(() => {
        if (pathOf(router.url) !== '/change-password')
          void router.navigateByUrl('/change-password', { replaceUrl: true });
      });
    });
  }
}
