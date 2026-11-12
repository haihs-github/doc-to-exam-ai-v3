// Created by Haihs on 12/11/2026
// Fixed UTC+7 date formatting by arithmetic (no Intl/ICU/locale), same algorithm as the web copy. Port of server/utils/dateFormat.js.
const VN_OFFSET_MS = 7 * 60 * 60 * 1000; // Vietnam has no DST
const pad = (n: number) => String(n).padStart(2, '0');

export function toVnFields(
  v: unknown,
): { dd: string; mm: string; yyyy: string; hh: string; mi: string; ss: string } | null {
  if (v === null || v === undefined || v === '') return null;
  const ms = v instanceof Date ? v.getTime() : new Date(v as string).getTime();
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms + VN_OFFSET_MS);
  if (Number.isNaN(d.getTime())) return null;
  return {
    dd: pad(d.getUTCDate()),
    mm: pad(d.getUTCMonth() + 1),
    yyyy: String(d.getUTCFullYear()).padStart(4, '0'),
    hh: pad(d.getUTCHours()),
    mi: pad(d.getUTCMinutes()),
    ss: pad(d.getUTCSeconds()),
  };
}
export const formatDate = (v: unknown): string => {
  const f = toVnFields(v);
  return f ? `${f.dd}/${f.mm}/${f.yyyy}` : '';
};
export const formatDateTime = (v: unknown): string => {
  const f = toVnFields(v);
  return f ? `${f.dd}/${f.mm}/${f.yyyy} ${f.hh}:${f.mi}` : '';
};
export const formatTimeSecondsDate = (v: unknown): string => {
  const f = toVnFields(v);
  return f ? `${f.hh}:${f.mi}:${f.ss} ${f.dd}/${f.mm}/${f.yyyy}` : '';
};
