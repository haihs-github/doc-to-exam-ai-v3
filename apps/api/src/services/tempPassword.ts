// Created by Haihs on 12/11/2026
// Temporary password generator (CSPRNG, no look-alike characters). Port of generateTempPassword in server/utils/passwordHash.js.
import { randomInt } from 'node:crypto';

// No I, O, 0, 1 (look alike when read aloud or copied by hand).
export const TEMP_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const TEMP_PASSWORD_LENGTH = 10;

/** randomInt is unbiased (rejection sampling), unlike `byte % n`. */
export const generateTempPassword = (): string =>
  Array.from(
    { length: TEMP_PASSWORD_LENGTH },
    () => TEMP_PASSWORD_ALPHABET[randomInt(TEMP_PASSWORD_ALPHABET.length)],
  ).join('');
