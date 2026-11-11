// Created by Haihs on 11/11/2026
// AES-256-GCM field encryption for secrets stored in the DB (port of server/utils/secureField.js).
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

// Format: enc:v1:<iv base64>:<authTag base64>:<ciphertext base64>
const PREFIX = 'enc:v1:';
const ALGORITHM = 'aes-256-gcm';

// scrypt (fixed salt, as in the source) lets a secret of any length become a 32-byte key.
const deriveKey = (secret: string) => scryptSync(secret, 'doc-to-exam-ai', 32);

/** No secret: returns the value unchanged (source behaviour). Already-encrypted values are not re-encrypted. */
export function encryptField(plain: string, secret: string | undefined): string {
  if (!plain) return '';
  if (!secret || plain.startsWith(PREFIX)) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, deriveKey(secret), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `${PREFIX}${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${data.toString('base64')}`;
}

/**
 * Legacy plain values (no prefix) come back unchanged. Unlike the source (which returns '' with a warning),
 * a missing/wrong secret or tampered data throws: callers decide how to degrade.
 */
export function decryptField(stored: string, secret: string | undefined): string {
  if (!stored || !stored.startsWith(PREFIX)) return stored;
  if (!secret) throw new Error('Encrypted field but no encryption secret configured');
  const [iv, tag, data] = stored.slice(PREFIX.length).split(':');
  if (!iv || !tag || !data) throw new Error('Malformed encrypted field');
  const decipher = createDecipheriv(ALGORITHM, deriveKey(secret), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString(
    'utf8',
  );
}

export const last4 = (plain: string): string => plain.slice(-4);
