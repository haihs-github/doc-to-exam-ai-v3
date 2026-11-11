// Created by Haihs on 11/11/2026
// Specs for <app-theme-toggle>: flips the dark class through applyTheme and persists via the theme module.
import { TestBed } from '@angular/core/testing';
import { ThemeToggle } from './theme-toggle';

const isDark = () => document.documentElement.classList.contains('dark');

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });
  afterEach(() => document.documentElement.classList.remove('dark'));

  it('toggles light -> dark -> light, persisting and updating its accessible label', async () => {
    const f = TestBed.createComponent(ThemeToggle);
    await f.whenStable();
    const btn = (f.nativeElement as HTMLElement).querySelector('button')!;
    expect(btn.getAttribute('aria-label')).toContain('Giao diện sáng');
    btn.click();
    await f.whenStable();
    expect(isDark()).toBe(true);
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(btn.getAttribute('aria-label')).toContain('Giao diện tối');
    btn.click();
    await f.whenStable();
    expect(isDark()).toBe(false);
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('starts from the class already on <html> (set before first paint)', async () => {
    document.documentElement.classList.add('dark');
    const f = TestBed.createComponent(ThemeToggle);
    await f.whenStable();
    const btn = (f.nativeElement as HTMLElement).querySelector('button')!;
    expect(btn.getAttribute('aria-label')).toContain('Giao diện tối');
    btn.click();
    await f.whenStable();
    expect(isDark()).toBe(false);
  });
});
