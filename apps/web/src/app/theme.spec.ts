// Created by Haihs on 11/11/2026
// Unit tests for applyTheme (class on <html>, matchMedia, localStorage failures) and contract path alias.
import { HTTP_STATUS } from '@doc-to-exam/contract';
import { applyTheme } from './theme';

const stubMatchMedia = (dark: boolean) => vi.stubGlobal('matchMedia', () => ({ matches: dark }));
const isDark = () => document.documentElement.classList.contains('dark');

describe('applyTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    stubMatchMedia(false);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('dark adds the dark class and persists the mode', () => {
    applyTheme('dark');
    expect(isDark()).toBe(true);
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('light removes the dark class', () => {
    document.documentElement.classList.add('dark');
    applyTheme('light');
    expect(isDark()).toBe(false);
  });

  it('system follows matchMedia', () => {
    stubMatchMedia(true);
    applyTheme('system');
    expect(isDark()).toBe(true);
    stubMatchMedia(false);
    applyTheme('system');
    expect(isDark()).toBe(false);
  });

  it('does not crash when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => applyTheme('dark')).not.toThrow();
    expect(isDark()).toBe(true);
    vi.restoreAllMocks();
  });
});

describe('@doc-to-exam/contract path alias', () => {
  it('resolves the source-only workspace package', () => {
    expect(HTTP_STATUS).toBeDefined();
  });
});
