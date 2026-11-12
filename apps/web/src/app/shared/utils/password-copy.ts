// Created by Haihs on 12/11/2026
// Text copied from the temporary-password box: passwords only, one per line (port of passwordCopy.js).
import type { ImportResultRow } from '@doc-to-exam/contract';

export function buildPasswordCopyText(rows: Partial<ImportResultRow>[] | null | undefined): string {
  return (rows ?? []).map((r) => r.temporaryPassword).join('\n');
}
