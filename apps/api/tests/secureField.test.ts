// Created by Haihs on 11/11/2026
// Tests for secureField: AES-256-GCM round trip, tamper/wrong-secret failure, no-secret passthrough, last4.
import { describe, expect, it } from 'vitest';
import { decryptField, encryptField, last4 } from '../src/lib/secureField';

const SECRET = 'unit-test-secret-0123456789';

describe('secureField', () => {
  it('round trips unicode plaintext', () => {
    const enc = encryptField('Khóa-API-🔑-abc', SECRET);
    expect(enc.startsWith('enc:v1:')).toBe(true);
    expect(decryptField(enc, SECRET)).toBe('Khóa-API-🔑-abc');
  });

  it('two encryptions of the same plaintext differ', () => {
    expect(encryptField('same', SECRET)).not.toBe(encryptField('same', SECRET));
  });

  it('flipped ciphertext byte throws', () => {
    const parts = encryptField('hello world', SECRET).split(':');
    const buf = Buffer.from(parts[4]!, 'base64');
    buf[0] ^= 0xff;
    parts[4] = buf.toString('base64');
    expect(() => decryptField(parts.join(':'), SECRET)).toThrow();
  });

  it('wrong secret throws', () => {
    expect(() =>
      decryptField(encryptField('x-value', SECRET), 'another-secret-0123456789'),
    ).toThrow();
  });

  it('enc: value without secret throws on decrypt', () => {
    expect(() => decryptField(encryptField('x-value', SECRET), undefined)).toThrow();
  });

  it('no secret: stored as-is, legacy plain decrypts to itself, empty stays empty', () => {
    expect(encryptField('plain-key', undefined)).toBe('plain-key');
    expect(decryptField('plain-key', SECRET)).toBe('plain-key');
    expect(encryptField('', SECRET)).toBe('');
  });

  it('does not double-encrypt an already encrypted value', () => {
    const enc = encryptField('abc', SECRET);
    expect(encryptField(enc, SECRET)).toBe(enc);
  });

  it('last4 returns the final 4 characters', () => {
    expect(last4('abcdefgh')).toBe('efgh');
    expect(last4('ab')).toBe('ab');
    expect(last4('')).toBe('');
  });
});
