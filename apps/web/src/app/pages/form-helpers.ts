// Created by Haihs on 11/11/2026
// Helpers shared by the auth pages: server field errors, focusing a field by name, the safe `from` navigation state.
import { Router } from '@angular/router';
import { isApiError } from '@doc-to-exam/contract';
import { errorMessage } from '../core/api-errors';

/** A server VALIDATION error aimed at one of `fields` (port of extractFieldError + REGISTER_ORDER.includes). */
export const fieldFailure = (
  e: unknown,
  fields: readonly string[],
): { field: string; message: string } | null =>
  isApiError(e) && e.code === 'VALIDATION' && e.field && fields.includes(e.field)
    ? { field: e.field, message: errorMessage(e) }
    : null;

/** Controls are found by `name`; `input[...]` skips the <app-password-field name=...> host element. */
export const focusField = (root: HTMLElement, name: string): void => {
  const el = root.querySelector<HTMLElement>(`input[name="${CSS.escape(name)}"]`);
  el?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  el?.focus({ preventScroll: true });
};

/** `from` set by authGuard (a path string). Only same-origin absolute paths are honoured. */
export const navigationFrom = (router: Router): string | undefined => {
  const from = (router.currentNavigation()?.extras.state as { from?: unknown } | undefined)?.from;
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//')
    ? from
    : undefined;
};
