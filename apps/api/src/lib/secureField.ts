// Created by Haihs on 11/11/2026
// AES-256-GCM field encryption for secrets stored in the DB (port of server/utils/secureField.js).
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

// Format: enc:v1:<iv base64>:<authTag base64>:<ciphertext base64>
const PREFIX = 'enc:v1:';
const ALGORITHM = 'aes-256-gcm';

const TAG_LEN = 16;
const IV_LEN = 12;
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

// scrypt (fixed salt, as in the source) lets a secret of any length become a 32-byte key.
// Memoized (one entry): scryptSync blocks the event loop for tens of ms.
let cached: { secret: string; key: Buffer } | undefined;
const deriveKey = (secret: string) => {
  if (cached?.secret !== secret) cached = { secret, key: scryptSync(secret, 'doc-to-exam-ai', 32) };
  return cached.key;
};

// Same rule as env.ts: only exact development/test (or unset/empty) NODE_ENV is relaxed.
const isProductionEnv = () => {
  const raw = process.env.NODE_ENV;
  return !!raw && raw !== 'development' && raw !== 'test';
};

export const isEncrypted = (value: string): boolean => value.startsWith(PREFIX);

/**
 * No secret: dev/test returns the value unchanged (source parity); production THROWS (never store a raw key).
 * Idempotent: a value already starting with `enc:v1:` is returned as-is, so callers must reject such INPUT
 * (use isEncrypted) BEFORE encrypting, or an attacker-supplied "enc:v1:..." would be stored unencrypted.
 * TODO(api): Task 8 — validate Gemini key (từ chối giá trị bắt đầu bằng 'enc:v1:'), bọc decryptField bằng try/catch → coi như chưa có key (REQUIRE_API_KEY), không 500
 * Haihs: đã xử lý ở models/User.ts (setGeminiApiKey từ chối enc:v1:, decrypt có try/catch) - start - end
 */
export function encryptField(plain: string, secret: string | undefined): string {
  if (!plain) return '';
  if (!secret) {
    if (isProductionEnv()) throw new Error('Encryption secret is required in production');
    return plain;
  }
  if (isEncrypted(plain)) return plain;
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGORITHM, deriveKey(secret), iv, { authTagLength: TAG_LEN });
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `${PREFIX}${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${data.toString('base64')}`;
}

const strictB64 = (x: string | undefined) => {
  if (!x || !B64.test(x)) throw new Error('Malformed encrypted field');
  const buf = Buffer.from(x, 'base64');
  if (buf.toString('base64') !== x) throw new Error('Malformed encrypted field');
  return buf;
};

/**
 * Legacy plain values (no prefix) come back unchanged. Unlike the source (which returns '' with a warning),
 * a missing/wrong secret, malformed format or tampered data throws: callers decide how to degrade.
 */
export function decryptField(stored: string, secret: string | undefined): string {
  if (!stored || !isEncrypted(stored)) return stored;
  if (!secret) throw new Error('Encrypted field but no encryption secret configured');
  const parts = stored.slice(PREFIX.length).split(':');
  if (parts.length !== 3) throw new Error('Malformed encrypted field');
  const [iv, tag, data] = parts.map(strictB64) as [Buffer, Buffer, Buffer];
  if (iv.length !== IV_LEN || tag.length !== TAG_LEN) throw new Error('Malformed encrypted field');
  const decipher = createDecipheriv(ALGORITHM, deriveKey(secret), iv, { authTagLength: TAG_LEN });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export const last4 = (plain: string): string => plain.slice(-4);
