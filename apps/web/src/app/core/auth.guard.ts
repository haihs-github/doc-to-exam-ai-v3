// Created by Haihs on 11/11/2026
// Route guard built on decideRoute; waits for the startup /me load so there is no flash of the login page.
import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, RedirectCommand, Router } from '@angular/router';
import type { UserRole } from '@doc-to-exam/contract';
import { filter, map, take } from 'rxjs';
import { decideRoute } from '../shared/utils/auth-routing';
import { AuthService } from './auth.service';

// TODO(web): Task 13 — dựng trang /session-error (message loadError + Thử lại + Đăng xuất)
export const SESSION_ERROR_PATH = '/session-error';

export const authGuard =
  (roles?: UserRole[], audience?: 'teacher' | 'student'): CanActivateFn =>
  (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const decide = () => {
      // transient /me failure with the token kept: show retry page, not login (source ProtectedRoute.jsx)
      if (!auth.user() && auth.loadError()) {
        return new RedirectCommand(router.parseUrl(SESSION_ERROR_PATH), {
          state: { from: state.url },
          replaceUrl: true,
        });
      }
      // state.url is the path: without it a mustChangePassword user loops on /change-password
      const d = decideRoute({ user: auth.user(), roles, audience, path: state.url });
      if (d.kind === 'allow') return true;
      const tree = router.parseUrl(d.to);
      // a UrlTree cannot carry navigation state (state.from), so use RedirectCommand when there is state
      return d.state
        ? new RedirectCommand(tree, {
            state: d.state as Record<string, unknown>,
            replaceUrl: true,
          })
        : tree;
    };
    return auth.isLoading()
      ? toObservable(auth.isLoading).pipe(
          filter((l) => !l),
          take(1),
          map(decide),
        )
      : decide();
  };
