// Created by Haihs on 11/11/2026
// Tests for secureField: AES-256-GCM round trip, tamper/wrong-secret failure, no-secret passthrough, last4.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { scryptSync } from 'node:crypto';
import { decryptField, encryptField, isEncrypted, last4 } from '../src/lib/secureField';

vi.mock('node:crypto', async (orig) => {
  const actual = await orig<typeof import('node:crypto')>();
  return { ...actual, scryptSync: vi.fn(actual.scryptSync) };
});
afterEach(() => vi.unstubAllEnvs());

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

  const mutate = (idx: number, fn: (b: Buffer) => Buffer) => {
    const parts = encryptField('hello world', SECRET).split(':');
    parts[idx] = fn(Buffer.from(parts[idx]!, 'base64')).toString('base64');
    return parts.join(':');
  };

  it('tampered tag (flip / truncate to 4 bytes) or flipped IV byte throws', () => {
    expect(() =>
      decryptField(
        mutate(3, (b) => ((b[0] ^= 1), b)),
        SECRET,
      ),
    ).toThrow();
    expect(() =>
      decryptField(
        mutate(3, (b) => b.subarray(0, 4)),
        SECRET,
      ),
    ).toThrow('Malformed');
    expect(() =>
      decryptField(
        mutate(2, (b) => ((b[0] ^= 1), b)),
        SECRET,
      ),
    ).toThrow();
  });

  it('malformed format throws Malformed encrypted field', () => {
    const [p, iv, tag, ct] = ['enc:v1', ...encryptField('hello', SECRET).slice(7).split(':')] as [
      string,
      string,
      string,
      string,
    ];
    const bad = [
      `${p}:${iv}:${tag}`,
      `${p}:${iv}:${tag}:${ct}:${ct}`,
      `${p}:${Buffer.alloc(8).toString('base64')}:${tag}:${ct}`,
      `${p}:${iv}:${tag}:***`,
      `${p}:${iv}:${tag}:`,
    ];
    for (const b of bad) expect(() => decryptField(b, SECRET)).toThrow('Malformed encrypted field');
  });

  it('production without secret throws; dev/test passes through', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => encryptField('key', undefined)).toThrow();
    expect(() => encryptField('key', '')).toThrow();
    vi.stubEnv('NODE_ENV', 'staging');
    expect(() => encryptField('key', undefined)).toThrow();
    vi.stubEnv('NODE_ENV', 'development');
    expect(encryptField('key', undefined)).toBe('key');
    vi.stubEnv('NODE_ENV', 'test');
    expect(encryptField('key', undefined)).toBe('key');
  });

  it('isEncrypted detects the prefix', () => {
    expect(isEncrypted(encryptField('a', SECRET))).toBe(true);
    expect(isEncrypted('plain')).toBe(false);
  });

  it('derives the key once per secret', () => {
    const spy = vi.mocked(scryptSync);
    encryptField('a', 'memo-secret-one-0123456');
    const base = spy.mock.calls.length;
    encryptField('b', 'memo-secret-one-0123456');
    decryptField(encryptField('c', 'memo-secret-one-0123456'), 'memo-secret-one-0123456');
    expect(spy.mock.calls.length).toBe(base);
    encryptField('d', 'memo-secret-two-0123456');
    expect(spy.mock.calls.length).toBe(base + 1);
  });
});
