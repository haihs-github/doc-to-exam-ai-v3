// Created by Haihs on 12/11/2026
// Specs for parseInviteToken: bare 43-char token or /join/<token> link on any origin; everything else is null.
import { parseInviteToken } from './invite-token';

const T = 'A'.repeat(20) + 'b_-9'.repeat(5) + 'xyz'; // 43 chars
describe('parseInviteToken', () => {
  it('fixture is 43 chars', () => expect(T).toHaveLength(43));

  it('accepts a bare token (trimmed)', () => {
    expect(parseInviteToken(T)).toBe(T);
    expect(parseInviteToken(`  ${T}\n`)).toBe(T);
  });

  it('extracts the token from a link on any origin or a bare /join path', () => {
    expect(parseInviteToken(`https://a.vn/join/${T}`)).toBe(T);
    expect(parseInviteToken(`http://192.168.1.5:3000/join/${T}`)).toBe(T);
    expect(parseInviteToken(`https://evil.example/join/${T}`)).toBe(T);
    expect(parseInviteToken(`/join/${T}`)).toBe(T);
  });

  it('allows trailing path segment, query or fragment after the token', () => {
    expect(parseInviteToken(`https://a.vn/join/${T}/`)).toBe(T);
    expect(parseInviteToken(`https://a.vn/join/${T}/extra`)).toBe(T);
    expect(parseInviteToken(`https://a.vn/join/${T}?x=1`)).toBe(T);
    expect(parseInviteToken(`https://a.vn/join/${T}#frag`)).toBe(T);
  });

  it('rejects bad characters, 42/44-length tokens, other paths, empty', () => {
    expect(parseInviteToken(T.slice(0, 42))).toBeNull();
    expect(parseInviteToken(T + 'a')).toBeNull();
    expect(parseInviteToken(`https://a.vn/join/${T}a`)).toBeNull();
    expect(parseInviteToken(`https://a.vn/join/${T.slice(0, 42)}`)).toBeNull();
    expect(parseInviteToken(T.slice(0, 42) + '+')).toBeNull();
    expect(parseInviteToken(T.slice(0, 42) + '=')).toBeNull();
    expect(parseInviteToken(`https://a.vn/other/${T}`)).toBeNull();
    expect(parseInviteToken(`https://a.vn/${T}`)).toBeNull();
    expect(parseInviteToken(`x ${T}`)).toBeNull();
    expect(parseInviteToken('')).toBeNull();
    expect(parseInviteToken('   ')).toBeNull();
  });

  it('null / non-string input -> null', () => {
    for (const v of [null, undefined, 123, {}, [T], true])
      expect(parseInviteToken(v as never)).toBeNull();
  });
});
