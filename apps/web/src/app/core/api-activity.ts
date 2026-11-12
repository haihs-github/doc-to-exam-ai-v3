// Created by Haihs on 11/11/2026
// Counts in-flight API requests (all / writes) so the UI can show progress and block double submits.
import { Injectable, computed, signal } from '@angular/core';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable({ providedIn: 'root' })
export class ApiActivity {
  private readonly _pending = signal(0);
  private readonly _writing = signal(0);
  readonly pending = this._pending.asReadonly();
  readonly writing = this._writing.asReadonly();
  readonly isBusy = computed(() => this._pending() > 0);

  begin(method: string): void {
    this._pending.update((n) => n + 1);
    if (!READ_METHODS.has(method.toUpperCase())) this._writing.update((n) => n + 1);
  }
  end(method: string): void {
    this._pending.update((n) => Math.max(0, n - 1));
    if (!READ_METHODS.has(method.toUpperCase())) this._writing.update((n) => Math.max(0, n - 1));
  }
}
