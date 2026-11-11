// Created by Haihs on 11/11/2026
// Name normalisation helpers (port of toProperName/toSearchKey from server/utils/textUtils.js).

/** "  nguyễn  văn ánh " -> "Nguyễn Văn Ánh"; non-strings pass through (source parity). */
export function toProperName<T>(raw: T): T | string {
  if (typeof raw !== 'string') return raw;
  return raw
    .normalize('NFC')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toLocaleUpperCase('vi') + w.slice(1).toLocaleLowerCase('vi'))
    .join(' ');
}

/** Search key: accent-stripped, lowercase ("Nguyễn Văn An" -> "nguyen van an"). */
export const toSearchKey = (raw: unknown): string =>
  String(raw ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
// Haihs: escapeRegExp cho tìm kiếm lớp theo tên/mã (Task 3) - start
export const escapeRegExp = (str: unknown): string => String(str ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Haihs: escapeRegExp cho tìm kiếm lớp theo tên/mã (Task 3) - end
