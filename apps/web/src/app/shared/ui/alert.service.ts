// Created by Haihs on 11/11/2026
// AlertService: FIFO popup queue (port of AlertProvider.jsx + alertQueue.js); each call resolves when its popup closes.
import { Injectable, computed, signal } from '@angular/core';

export type AlertVariant = 'success' | 'error' | 'warning';
export interface AlertOptions {
  title?: string;
  secondaryLabel?: string;
  onSecondary?: () => void;
}
export interface AlertItem extends AlertOptions {
  id: number;
  variant: AlertVariant;
  message: string;
  resolvers: (() => void)[];
}

@Injectable({ providedIn: 'root' })
export class AlertService {
  private nextId = 0;
  private readonly queue = signal<AlertItem[]>([]);
  /** First item = the popup on screen. */
  readonly current = computed(() => this.queue()[0] ?? null);

  success(message: string, opts?: AlertOptions): Promise<void> {
    return this.show('success', message, opts);
  }
  error(message: string, opts?: AlertOptions): Promise<void> {
    return this.show('error', message, opts);
  }
  warning(message: string, opts?: AlertOptions): Promise<void> {
    return this.show('warning', message, opts);
  }

  /** Closes the current popup and resolves every call merged into it. */
  close(): void {
    const [item, ...rest] = this.queue();
    if (!item) return;
    this.queue.set(rest);
    item.resolvers.forEach((r) => r());
  }

  /** Host teardown: settle every pending call (secondary actions are not run) so callers never hang. */
  clear(): void {
    const q = this.queue();
    this.queue.set([]);
    q.forEach((i) => i.resolvers.forEach((r) => r()));
  }

  private show(variant: AlertVariant, message: string, opts: AlertOptions = {}): Promise<void> {
    return new Promise<void>((resolve) => {
      this.queue.update((q) => {
        const last = q[q.length - 1];
        // Consecutive identical popups (variant, message, title, secondary action) share one.
        if (
          last &&
          last.variant === variant &&
          last.message === message &&
          last.title === opts.title &&
          last.secondaryLabel === opts.secondaryLabel &&
          last.onSecondary === opts.onSecondary
        )
          return [...q.slice(0, -1), { ...last, resolvers: [...last.resolvers, resolve] }];
        return [...q, { ...opts, id: this.nextId++, variant, message, resolvers: [resolve] }];
      });
    });
  }
}
