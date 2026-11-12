// Created by Haihs on 12/11/2026
// Overlap rule: two sittings of the same class clash only in the same OPEN MINUTE (window [minute, minute + 60s)). Port of server/utils/sittingOverlap.js.
export const MINUTE_MS = 60 * 1000;

export function minuteWindow(openAt: Date | string | number): { from: Date; to: Date } {
  const ms = new Date(openAt).getTime();
  const from = Math.floor(ms / MINUTE_MS) * MINUTE_MS;
  return { from: new Date(from), to: new Date(from + MINUTE_MS) };
}
