// Created by Haihs on 12/11/2026
// Parse/mask the "dd/mm/yyyy hh:mm" text used for sitting times (UTC+7, no DST). Source: SittingSettingsFields / dateTime utils.
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const RE = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/;

/** "dd/mm/yyyy hh:mm" (UTC+7) -> Date, or null when malformed or not a real calendar time. */
export function parseVnDateTime(text: string): Date | null {
  const m = RE.exec(text.trim());
  if (!m) return null;
  const [dd, mm, yyyy, hh, mi] = m.slice(1).map(Number);
  const utc = Date.UTC(yyyy, mm - 1, dd, hh, mi) - VN_OFFSET_MS;
  const d = new Date(utc);
  const back = new Date(utc + VN_OFFSET_MS); // round-trip rejects 31/02 and 25:61
  const ok =
    back.getUTCFullYear() === yyyy &&
    back.getUTCMonth() === mm - 1 &&
    back.getUTCDate() === dd &&
    back.getUTCHours() === hh &&
    back.getUTCMinutes() === mi;
  return ok ? d : null;
}

/** Digits typed so far -> "dd/mm/yyyy hh:mm" progressively (max 12 digits). */
export function maskVnDateTime(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 12);
  const parts = [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join('/');
  const time = [d.slice(8, 10), d.slice(10, 12)].filter(Boolean).join(':');
  return time ? `${parts} ${time}` : parts;
}
