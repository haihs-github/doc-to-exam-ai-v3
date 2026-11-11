// Created by Haihs on 11/11/2026
// Tests for clientIp (trust-proxy aware client address extraction).
import { describe, expect, it } from 'vitest';
import { clientIp } from '../src/lib/clientIp';

const req = (xff?: string) =>
  new Request('http://x/', { headers: xff === undefined ? {} : { 'x-forwarded-for': xff } });

describe('clientIp', () => {
  it('ignores X-Forwarded-For when trustProxy=0', () => {
    expect(clientIp(req('1.1.1.1'), 0)).toBe('unknown');
  });
  it('takes the rightmost entry for trustProxy=1 (spoofed left entries ignored)', () => {
    expect(clientIp(req('6.6.6.6, 2.2.2.2'), 1)).toBe('2.2.2.2');
  });
  it('takes the Nth entry from the right for trustProxy=2', () => {
    expect(clientIp(req('6.6.6.6, 2.2.2.2, 10.0.0.1'), 2)).toBe('2.2.2.2');
  });
  it('returns unknown when the header has fewer entries than trustProxy', () => {
    expect(clientIp(req('2.2.2.2'), 3)).toBe('unknown');
  });
  it.each([undefined, '', ' , ,'])('never throws on missing/malformed header %j', (h) => {
    expect(clientIp(req(h), 1)).toBe('unknown');
  });
  it('caps an absurdly long entry', () => {
    expect(clientIp(req('x'.repeat(500)), 1).length).toBeLessThanOrEqual(64);
  });
  it('treats negative/NaN trustProxy as 0', () => {
    expect(clientIp(req('1.1.1.1'), -1)).toBe('unknown');
    expect(clientIp(req('1.1.1.1'), Number.NaN)).toBe('unknown');
  });
});
