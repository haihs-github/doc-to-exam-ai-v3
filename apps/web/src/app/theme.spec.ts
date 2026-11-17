// Created by Haihs on 11/11/2026
// Unit tests for applyTheme (class on <html>, matchMedia, localStorage failures) and contract path alias.
import { HTTP_STATUS } from '@doc-to-exam/contract';
import { applyTheme } from './theme';
// Haihs: đọc cấu hình Tailwind (JS thuần, không có kiểu) để kiểm tra token - start
// @ts-expect-error tailwind.config.js không có khai báo kiểu
import tailwindConfig from '../../tailwind.config.js';
// Haihs: đọc cấu hình Tailwind để kiểm tra token - end

const stubMatchMedia = (dark: boolean) =>
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: dark && q === '(prefers-color-scheme: dark)',
  }));
const isDark = () => document.documentElement.classList.contains('dark');

describe('applyTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    stubMatchMedia(false);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('dark adds the dark class and persists the mode', () => {
    applyTheme('dark');
    expect(isDark()).toBe(true);
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('light removes the dark class', () => {
    document.documentElement.classList.add('dark');
    applyTheme('light');
    expect(isDark()).toBe(false);
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('system follows matchMedia', () => {
    stubMatchMedia(true);
    applyTheme('system');
    expect(isDark()).toBe(true);
    expect(localStorage.getItem('theme')).toBe('system');
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
  });
});

describe('@doc-to-exam/contract path alias', () => {
  it('resolves the source-only workspace package', () => {
    expect(HTTP_STATUS).toBeDefined();
  });
});

// Haihs: kiểm tra token giao diện enterprise (Task 0) - start
describe('theme tokens', () => {
  const colors = tailwindConfig.theme.extend.colors;
  it('primary, success, status, type scales exist', () => {
    expect(colors.primary[700]).toBe('#1a67a3');
    expect(colors.success[600]).toBeDefined();
    for (const k of ['new', 'progress', 'confirmed', 'resolved', 'closed']) expect(colors.status[k]).toBeDefined();
    for (const k of ['bug', 'feature', 'task']) expect(colors.type[k]).toBeDefined();
  });
  it('sky/blue/violet/indigo alias primary; gray/slate stay ink', () => {
    for (const k of ['sky', 'blue', 'violet', 'indigo']) expect(colors[k]).toBe(colors.primary);
    expect(colors.gray).toBe(colors.slate);
    expect(colors.gray).not.toBe(colors.primary);
  });
});
// Haihs: kiểm tra token giao diện enterprise (Task 0) - end
