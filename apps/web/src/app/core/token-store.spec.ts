// Created by Haihs on 11/11/2026
// Specs for TokenStore (localStorage wrapper that never throws).
import { TOKEN_KEY, TokenStore } from './token-store';

describe('TokenStore', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('set/get/clear dùng khóa auth_token và xóa khóa cũ', () => {
    const s = new TokenStore();
    expect(TOKEN_KEY).toBe('auth_token');
    expect(s.get()).toBeNull();
    localStorage.setItem('teacher_auth_token', 'old');
    s.set('abc');
    expect(localStorage.getItem('auth_token')).toBe('abc');
    expect(s.get()).toBe('abc');
    expect(localStorage.getItem('teacher_auth_token')).toBeNull();
    s.clear();
    expect(s.get()).toBeNull();
  });

  it('không crash khi localStorage ném lỗi', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('x');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('x');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('x');
    });
    const s = new TokenStore();
    expect(s.get()).toBeNull();
    expect(() => s.set('a')).not.toThrow();
    expect(() => s.clear()).not.toThrow();
  });

  it('clear() xóa cả khóa legacy', () => {
    localStorage.setItem('auth_token', 'a');
    localStorage.setItem('teacher_auth_token', 'old');
    new TokenStore().clear();
    expect(localStorage.getItem('teacher_auth_token')).toBeNull();
    expect(localStorage.getItem('auth_token')).toBeNull();
  });

  it('clear() vẫn xóa legacy khi removeItem(TOKEN_KEY) ném lỗi', () => {
    localStorage.setItem('teacher_auth_token', 'old');
    const real = Storage.prototype.removeItem;
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (
      this: Storage,
      k: string,
    ) {
      if (k === 'auth_token') throw new Error('x');
      real.call(this, k);
    });
    new TokenStore().clear();
    expect(localStorage.getItem('teacher_auth_token')).toBeNull();
  });
});
