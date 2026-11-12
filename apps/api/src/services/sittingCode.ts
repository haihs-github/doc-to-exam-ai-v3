// Created by Haihs on 12/11/2026
// 6-character sitting code (32-char alphabet without I O 0 1) via crypto.randomInt, retried on a unique clash. Port of server/services/sittingCode.js.
import { randomInt } from 'node:crypto';
import { HttpError } from '../lib/handler';

export const SITTING_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const SITTING_CODE_LENGTH = 6;
export const MAX_CODE_ATTEMPTS = 5;

export const generateSittingCode = (): string =>
  Array.from(
    { length: SITTING_CODE_LENGTH },
    () => SITTING_CODE_ALPHABET[randomInt(SITTING_CODE_ALPHABET.length)],
  ).join('');

const isDuplicateCodeError = (err: unknown): boolean => {
  const e = err as { code?: unknown; keyPattern?: { code?: unknown }; message?: string } | null;
  return e?.code === 11000 && Boolean(e.keyPattern?.code || /\bcode_1\b/.test(e.message ?? ''));
};

/** Calls write(code) with a fresh code; E11000 on `code` retries (max 5), then 503 CODE_GENERATION_FAILED. Used by create and "regenerate". */
export async function withUniqueSittingCode<T>(write: (code: string) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    try {
      return await write(generateSittingCode());
    } catch (err) {
      if (!isDuplicateCodeError(err)) throw err;
    }
  }
  throw new HttpError('CODE_GENERATION_FAILED', 'Không sinh được mã ca duy nhất, hãy thử lại.');
}
