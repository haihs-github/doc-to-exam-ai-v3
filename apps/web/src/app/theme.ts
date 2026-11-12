// Created by Haihs on 11/11/2026
// Light/dark/system theme: toggles the `dark` class on <html> and persists the choice.
export type ThemeMode = 'light' | 'dark' | 'system';

export function applyTheme(mode: ThemeMode): void {
  const dark =
    mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  try {
    localStorage.setItem('theme', mode);
  } catch {
    // storage blocked: the class is already applied, only persistence is lost
  }
}
