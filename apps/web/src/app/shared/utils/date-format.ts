// Created by Haihs on 11/11/2026
// Fixed UTC+7 date formatting by arithmetic (no Intl/locale); port of client/src/utils/dateFormat.js.
const VN_OFFSET_MS = 7 * 60 * 60 * 1000; // dateFormat.js:5 - Vietnam has no DST

const pad = (n: number) => String(n).padStart(2, '0');

type DateInput = Date | string | number | null | undefined;

// dateFormat.js:10
export function toVnFields(v: DateInput) {
  if (v === null || v === undefined || v === '') return null;
  const ms = v instanceof Date ? v.getTime() : new Date(v).getTime();
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms + VN_OFFSET_MS);
  return {
    dd: pad(d.getUTCDate()),
    mm: pad(d.getUTCMonth() + 1),
    yyyy: String(d.getUTCFullYear()).padStart(4, '0'),
    hh: pad(d.getUTCHours()),
    mi: pad(d.getUTCMinutes()),
    ss: pad(d.getUTCSeconds()),
  };
}

// dateFormat.js:25
export function formatDateParts(v: DateInput) {
  const f = toVnFields(v);
  return f
    ? { date: `${f.dd}/${f.mm}/${f.yyyy}`, time: `${f.hh}:${f.mi}` }
    : { date: '', time: '' };
}

// dateFormat.js:29
export const formatDate = (v: DateInput) => formatDateParts(v).date;

// dateFormat.js:33
export function formatDateTime(v: DateInput) {
  const { date, time } = formatDateParts(v);
  return date ? `${date} ${time}` : '';
}

// dateFormat.js:38
export function formatTimeSecondsDate(v: DateInput) {
  const f = toVnFields(v);
  return f ? `${f.hh}:${f.mi}:${f.ss} ${f.dd}/${f.mm}/${f.yyyy}` : '';
}

// Brief's public name: dd/mm/yyyy HH:mm in UTC+7.
export const formatVn = (date: Date | string): string => formatDateTime(date);
