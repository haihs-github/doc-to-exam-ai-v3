// Created by Haihs on 12/11/2026
// Names for copies of an exam: "<name> (bản sao)", "(bản sao 2)"... Pure functions. Port of server/utils/examCopyName.js.

export const MAX_COPY_TITLE_LENGTH = 200;
const COPY_SUFFIX_PATTERN = /\s*\(bản sao(?:\s+\d+)?\)\s*$/i;

/** Drops a trailing "(bản sao N)" so copying a copy does not nest suffixes. */
export const stripCopySuffix = (title: unknown): string => {
  const clean = String(title ?? '').trim();
  return clean.replace(COPY_SUFFIX_PATTERN, '').trim() || clean;
};

/** Copy number n >= 1; the base name is cut when too long, the suffix is kept. */
export const buildCopyTitle = (
  baseTitle: string,
  n: number,
  maxLength = MAX_COPY_TITLE_LENGTH,
): string => {
  const suffix = n <= 1 ? ' (bản sao)' : ` (bản sao ${n})`;
  const room = Math.max(1, maxLength - suffix.length);
  return `${String(baseTitle).trim().slice(0, room).trim()}${suffix}`;
};
