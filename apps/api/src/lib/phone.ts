// Created by Haihs on 11/11/2026
// The ONE phone normaliser shared by rate-limit keys, validation and account lookup (so they always agree).

/** Vietnamese phone after normalisation: starts with 0, 10-11 digits in total. */
export const PHONE_RE = /^0\d{9,10}$/;

/** Trim and strip space . - ; '' for non-strings or raw input longer than 32 chars. Does NOT check the format. */
export function normalizePhone(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length > 32) return '';
  return raw.trim().replace(/[\s.-]/g, '');
}
