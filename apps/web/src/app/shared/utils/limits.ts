// Created by Haihs on 11/11/2026
// Length limits and pure validate/clamp helpers; port of client/src/utils/limits.js (must match server limits).
export const LIMITS = {
  TITLE_MAX: 255, // limits.js:5
  DESCRIPTION_MAX: 255, // limits.js:6
  FULL_NAME_MAX: 255, // limits.js:7
  CLASS_NAME_MAX: 100, // limits.js:8
  CLASS_CODE_MAX: 30, // limits.js:9
} as const;
export type LimitKey = keyof typeof LIMITS;

// limits.js:18
export function exceedsLimit(value: unknown, key: LimitKey): boolean {
  if (!(key in LIMITS)) throw new Error(`Khóa giới hạn không tồn tại: ${key}`);
  return typeof value === 'string' && value.length > LIMITS[key];
}

// limits.js:24 - '' when valid, else a Vietnamese message naming the limit and current length.
export function validateMaxLength(value: unknown, key: LimitKey, label: string): string {
  if (!exceedsLimit(value, key)) return '';
  return `${label} tối đa ${LIMITS[key]} ký tự (hiện ${(value as string).length}).`;
}

// limits.js:30 - for <option> text where CSS clamp is unavailable.
export function clampText(text: unknown, max: number): string {
  const s = text == null ? '' : String(text);
  return s.length > max ? `${s.slice(0, Math.max(0, max - 1))}…` : s;
}
