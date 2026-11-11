// Created by Haihs on 11/11/2026
// localStorage wrapper for the auth token; never throws (private mode / blocked storage).
import { Injectable } from '@angular/core';

export const TOKEN_KEY = 'auth_token';
const LEGACY_KEY = 'teacher_auth_token';

@Injectable({ providedIn: 'root' })
export class TokenStore {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }
  set(t: string): void {
    try {
      localStorage.setItem(TOKEN_KEY, t);
      localStorage.removeItem(LEGACY_KEY);
    } catch {
      /* storage unavailable */
    }
  }
  clear(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(LEGACY_KEY);
    } catch {
      /* storage unavailable */
    }
  }
}
