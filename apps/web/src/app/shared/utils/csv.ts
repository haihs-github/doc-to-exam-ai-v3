// Created by Haihs on 12/11/2026
// CSV cell/file builders with formula-injection guard; port of client/src/utils/csv.js.
const BOM = '﻿'; // lets Excel read UTF-8 Vietnamese
// A cell that Excel/Sheets would run as a formula, even behind whitespace/control/invisible-format chars.
const FORMULA_START = /^[\s\p{Cc}\p{Cf}]*[=+\-@]|^[\t\r]/u;

/** Real numbers stay numeric; strings that look like formulas get a leading ' so they stay text. */
export function toCsvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (typeof value !== 'number' && FORMULA_START.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildCsv(headers: string[], rows: unknown[][]): string {
  return `${BOM}${[headers, ...rows].map((row) => row.map(toCsvCell).join(',')).join('\r\n')}`;
}
