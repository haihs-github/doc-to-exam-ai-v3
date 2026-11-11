// Created by Haihs on 11/11/2026
// HTTP interceptor: Bearer token for same-origin /api calls, 401/403-MUST_CHANGE_PASSWORD events, request activity count.
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, finalize, throwError } from 'rxjs';
import { ApiActivity } from './api-activity';
import { TokenStore } from './token-store';

export const UNAUTHENTICATED_EVENT = 'auth:unauthenticated';
export const MUST_CHANGE_PASSWORD_EVENT = 'auth:must-change-password';

// Never send the token off-origin or to non-API urls.
const isApiUrl = (url: string): boolean => {
  try {
    const u = new URL(url, location.origin);
    return (
      u.origin === location.origin && (u.pathname === '/api' || u.pathname.startsWith('/api/'))
    );
  } catch {
    return false;
  }
};

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokens = inject(TokenStore);
  const activity = inject(ApiActivity);
  const api = isApiUrl(req.url);
  const token = api ? tokens.get() : null;
  const out = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  activity.begin(req.method);
  return next(out).pipe(
    catchError((e: unknown) => {
      if (api && e instanceof HttpErrorResponse) {
        if (e.status === 401) {
          tokens.clear();
          window.dispatchEvent(new CustomEvent(UNAUTHENTICATED_EVENT));
        } else if (
          e.status === 403 &&
          (e.error as { code?: unknown } | null)?.code === 'MUST_CHANGE_PASSWORD'
        ) {
          window.dispatchEvent(new CustomEvent(MUST_CHANGE_PASSWORD_EVENT));
        }
      }
      return throwError(() => e);
    }),
    finalize(() => activity.end(req.method)),
  );
};
